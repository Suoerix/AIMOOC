import { SubtitleData, VideoInfo, VideoPage } from '~/lib/types'

const BILIBILI_API = process.env.BILIBILI_API_BASE || 'https://api.bilibili.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

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
    console.error('Failed to create BILIBILI_PROXY agent:', error)
    return undefined
  }
}

let cachedBuvidCookie: string | null | undefined

function randomBuvid3(): string {
  const hex = () =>
    Array.from({ length: 6 }, () =>
      '0123456789ABCDEF'[Math.floor(Math.random() * 16)]
    ).join('')
  return `XY${hex()}${hex()}${hex()}${hex()}infoc`
}

async function getBuvidCookie(): Promise<string | null> {
  if (cachedBuvidCookie !== undefined) return cachedBuvidCookie
  try {
    const response = await biliFetchRaw('https://www.bilibili.com/', {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    })
    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies =
      typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
    const buvid = setCookies
      .map((raw: string) => raw.split(';')[0].trim())
      .filter((kv: string) => /^(buvid3|b_nut|b_lsid)=/i.test(kv))
    cachedBuvidCookie = buvid.length ? buvid.join('; ') : null
  } catch {
    cachedBuvidCookie = null
  }
  return cachedBuvidCookie
}

export async function biliFetchRaw(
  url: string,
  headers: Record<string, string>,
  opts: { withBuvid?: boolean } = {}
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
  return fetch(url, init as RequestInit)
}

export function extractBvid(url: string): string | undefined {
  return (
    url.match(/\/video\/(BV[a-zA-Z0-9]+)/)?.[1] ||
    url.match(/b23\.tv\/(BV[a-zA-Z0-9]+)/)?.[1]
  )
}

export async function normalizeBiliUrl(url: string): Promise<string> {
  if (url.includes('b23.tv')) {
    try {
      const response = await biliFetchRaw(url, {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.bilibili.com/',
      })
      if (response.url.includes('bilibili.com/video/')) {
        return response.url
      }
    } catch (error) {
      console.error('Error normalizing b23.tv url:', error)
    }
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
    const sessdata = sessionCookie.includes('SESSDATA')
      ? sessionCookie
      : `SESSDATA=${sessionCookie}`
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
  cookie?: string
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

export async function getVideoInfoFromUrl(
  url: string,
  cookie?: string
): Promise<Partial<VideoInfo>> {
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

export async function fetchSubtitles(
  url: string,
  cookie?: string
): Promise<SubtitleData[]> {
  const { bvid, cid } = await getVideoMeta(url, cookie)
  const playerData = await biliFetch<{ subtitle: { subtitles: SubtitleEntry[] } }>(
    `/x/player/wbi/v2?bvid=${bvid}&cid=${cid}`,
    cookie
  )
  const subtitles = playerData?.subtitle?.subtitles || []
  const results = await Promise.all(
    subtitles.map(async (entry) => {
      const subtitleUrl = entry.subtitle_url.startsWith('//')
        ? `https:${entry.subtitle_url}`
        : entry.subtitle_url
      const res = await biliFetchRaw(subtitleUrl, biliHeaders(cookie))
      if (!res.ok) return null
      const body = (await res.json()) as { body: SubtitleBodyItem[] }
      return {
        lan: entry.lan,
        subtitle: body.body,
      } satisfies SubtitleData
    })
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
      cookie
    )
    if (!data.isLogin) return null
    return { mid: data.mid, uname: data.uname, face: data.face }
  } catch {
    return null
  }
}

export async function getPlayUrl(
  url: string,
  cookie?: string
): Promise<{ playUrl: string; size: number }> {
  const { bvid, cid } = await getVideoMeta(url, cookie)
  const data = await biliFetch<PlayUrlData>(
    `/x/player/playurl?bvid=${bvid}&cid=${cid}&qn=64&platform=html5&high_quality=1&fnval=1`,
    cookie
  )
  if (!data.durl?.length) {
    throw new Error('No playable video url found')
  }
  return { playUrl: data.durl[0].url, size: data.durl[0].size }
}
