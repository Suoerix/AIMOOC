import { SubtitleData, VideoInfo, VideoPage } from '~/lib/types'
import { parseSafeUrl, isAllowedUrl, safeResolveRedirect, isPrivateHost, BILIBILI_HOSTS } from '~/lib/security/url'
import { logInternalError } from '~/lib/security/request'

const OFFICIAL_BILIBILI_API = 'https://api.bilibili.com'

/**
 * 自定义反代地址必须是通过安全解析的公网 https 地址，否则回退官方域名。
 * 防止把 BILIBILI_API_BASE 指向内网 / 元数据服务形成 SSRF。
 */
function resolveApiBase(): string {
  const raw = process.env.BILIBILI_API_BASE
  if (!raw) return OFFICIAL_BILIBILI_API
  const parsed = parseSafeUrl(raw)
  if (!parsed || isPrivateHost(parsed.hostname)) return OFFICIAL_BILIBILI_API
  // 只取 origin，避免环境变量里夹带 path / query 污染接口路径
  return parsed.origin
}

const BILIBILI_API = resolveApiBase()
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** 外联统一超时，避免上游挂起拖死 Serverless 函数 */
const FETCH_TIMEOUT_MS = 12_000

/**
 * 带超时的 fetch。用 AbortController + setTimeout 的兼容写法，
 * 不依赖 AbortSignal.timeout（TypeScript 4.9 / @types/node 18 未必有类型）。
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { dispatcher?: unknown } = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal } as RequestInit)
  } finally {
    clearTimeout(timer)
  }
}

let proxyDispatcher: unknown | undefined

function getProxyDispatcher(): unknown | undefined {
  const proxyUrl = process.env.BILIBILI_PROXY
  if (!proxyUrl) return undefined
  if (proxyDispatcher) return proxyDispatcher
  try {
    const { ProxyAgent } = require('undici') as typeof import('undici')
    proxyDispatcher = new ProxyAgent(proxyUrl)
    return proxyDispatcher
  } catch (error) {
    logInternalError('getProxyDispatcher', error)
    return undefined
  }
}

/** 只缓存成功取到的 buvid；失败仅记录时间戳，短 TTL 后可重试 */
let cachedBuvidCookie: string | undefined
let lastBuvidFailureAt = 0
const BUVID_RETRY_TTL_MS = 30_000

function randomBuvid3(): string {
  const hex = () => Array.from({ length: 6 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)]).join('')
  return `XY${hex()}${hex()}${hex()}${hex()}infoc`
}

async function getBuvidCookie(): Promise<string | null> {
  if (cachedBuvidCookie) return cachedBuvidCookie
  // 失败态绝不永久缓存，只在短 TTL 内跳过重试
  if (Date.now() - lastBuvidFailureAt < BUVID_RETRY_TTL_MS) return null
  try {
    const response = await biliFetchRaw('https://www.bilibili.com/', {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    })
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
    const buvid = setCookies
      .map((raw: string) => raw.split(';')[0].trim())
      .filter((kv: string) => /^(buvid3|b_nut|b_lsid)=/i.test(kv))
    if (!buvid.length) {
      lastBuvidFailureAt = Date.now()
      return null
    }
    cachedBuvidCookie = buvid.join('; ')
    return cachedBuvidCookie
  } catch (error) {
    logInternalError('getBuvidCookie', error)
    lastBuvidFailureAt = Date.now()
    return null
  }
}

export async function biliFetchRaw(
  url: string,
  headers: Record<string, string>,
  opts: { withBuvid?: boolean } = {},
): Promise<Response> {
  const dispatcher = getProxyDispatcher()
  const init: RequestInit & { dispatcher?: unknown } = { headers, redirect: 'follow' }

  if (opts.withBuvid && !headers.Cookie) {
    const buvid = await getBuvidCookie()
    if (buvid) {
      init.headers = { ...headers, Cookie: buvid }
    }
  }

  if (dispatcher) {
    init.dispatcher = dispatcher
  }
  return fetchWithTimeout(url, init)
}

export function extractBvid(url: string): string | undefined {
  return url.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1] || url.match(/b23\.tv\/(BV[a-zA-Z0-9]+)/)?.[1]
}

export async function normalizeBiliUrl(url: string): Promise<string> {
  if (!url.includes('b23.tv')) return url
  try {
    // 逐跳跟随重定向并逐跳校验域名，杜绝 b23.tv 开放重定向打到内网，
    // 也避免用 response.url.includes('bilibili.com') 的子域绕过。
    const resolved = await safeResolveRedirect(url, BILIBILI_HOSTS)
    if (resolved) return resolved.toString()
  } catch (error) {
    logInternalError('normalizeBiliUrl', error)
  }
  return url
}

export function extractPageParam(url: string): number {
  const p = new URL(url).searchParams.get('p')
  return p ? Number(p) : 1
}

export function biliHeaders(cookie?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Referer: 'https://www.bilibili.com/',
  }
  const sessionCookie = cookie || process.env.BILIBILI_SESSION_TOKEN || ''
  if (sessionCookie) {
    const sessdata = sessionCookie.includes('SESSDATA') ? sessionCookie : `SESSDATA=${sessionCookie}`
    headers.Cookie = sessdata
  }
  return headers
}

interface BiliApiResponse<T> {
  code: number
  message: string
  data: T
}

async function biliFetch<T>(path: string, cookie?: string): Promise<T> {
  const response = await biliFetchRaw(`${BILIBILI_API}${path}`, biliHeaders(cookie), {
    withBuvid: true,
  })
  if (!response.ok) {
    throw new Error(`Bilibili API request failed: ${response.status}`)
  }
  const json = (await response.json()) as BiliApiResponse<T>
  if (json.code !== 0) {
    throw new Error(`Bilibili API error: ${json.code} ${json.message}`)
  }
  return json.data
}

interface ViewData {
  bvid: string
  cid: number
  title: string
  desc: string
  owner: { name: string; face: string }
  pages: VideoPage[]
}

async function getViewData(url: string, cookie?: string): Promise<ViewData> {
  const normalized = await normalizeBiliUrl(url)
  const bvid = extractBvid(normalized)
  if (!bvid) {
    throw new Error('Invalid bilibili video url')
  }
  return biliFetch<ViewData>(`/x/web-interface/view?bvid=${bvid}`, cookie)
}

export async function getVideoMeta(
  url: string,
  cookie?: string,
): Promise<{ bvid: string; cid: number; title: string; pages: VideoPage[] }> {
  const data = await getViewData(url, cookie)
  const pageNumber = extractPageParam(url)
  const page = data.pages.find((p) => p.page === pageNumber) || data.pages[0]
  return {
    bvid: data.bvid,
    cid: page?.cid ?? data.cid,
    title: data.title,
    pages: data.pages,
  }
}

export async function getVideoInfoFromUrl(url: string, cookie?: string): Promise<Partial<VideoInfo>> {
  const data = await getViewData(url, cookie)
  return {
    title: data.title,
    description: data.desc,
    owner: { name: data.owner.name, face: data.owner.face },
    pages: data.pages,
  }
}

interface SubtitleEntry {
  lan: string
  lan_doc: string
  subtitle_url: string
}

interface SubtitleBodyItem {
  from: number
  to: number
  location: number
  content: string
}

export async function fetchSubtitles(url: string, cookie?: string): Promise<SubtitleData[]> {
  const { bvid, cid } = await getVideoMeta(url, cookie)
  const playerData = await biliFetch<{ subtitle: { subtitles: SubtitleEntry[] } }>(
    `/x/player/wbi/v2?bvid=${bvid}&cid=${cid}`,
    cookie,
  )
  const subtitles = playerData?.subtitle?.subtitles || []
  const results = await Promise.all(
    subtitles.map(async (entry) => {
      const subtitleUrl = entry.subtitle_url.startsWith('//') ? `https:${entry.subtitle_url}` : entry.subtitle_url
      // 上游返回的字幕地址必须落在 B 站白名单内且非私网，防止自定义地址形成 SSRF
      if (!isAllowedUrl(subtitleUrl, BILIBILI_HOSTS)) return null
      const res = await biliFetchRaw(subtitleUrl, biliHeaders(cookie))
      if (!res.ok) return null
      const body = (await res.json()) as { body: SubtitleBodyItem[] }
      return {
        lan: entry.lan,
        subtitle: body.body,
      } satisfies SubtitleData
    }),
  )
  return results.filter((item): item is SubtitleData => item !== null)
}

interface PlayUrlData {
  durl: { url: string; size: number }[]
}

export interface BiliUser {
  mid: number
  uname: string
  face: string
}

export async function verifyBiliCookie(cookie: string): Promise<BiliUser | null> {
  try {
    const data = await biliFetch<{ isLogin: boolean; mid: number; uname: string; face: string }>(
      '/x/web-interface/nav',
      cookie,
    )
    if (!data.isLogin) return null
    return { mid: data.mid, uname: data.uname, face: data.face }
  } catch {
    return null
  }
}

export async function getPlayUrl(url: string, cookie?: string): Promise<{ playUrl: string; size: number }> {
  const { bvid, cid } = await getVideoMeta(url, cookie)
  const data = await biliFetch<PlayUrlData>(
    `/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64&platform=html5&high_quality=1&fnval=1`,
    cookie,
  )
  if (!data.durl?.length) {
    throw new Error('No playable video url found')
  }
  return { playUrl: data.durl[0].url, size: data.durl[0].size }
}
