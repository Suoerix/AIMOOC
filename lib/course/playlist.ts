/**
 * 合集 / 播放列表解析：把「一个合集链接」或「多个视频链接」变成有序的课程章节。
 *
 * 两种来源：
 * 1. 自动解析：B站多P视频、B站合集(ml)、YouTube 播放列表(list) —— best-effort，
 *    依赖第三方接口，失败会抛出 PlaylistFetchError，由上层引导用户改用「逐条粘贴」。
 * 2. 手动多链接：用户在一处粘贴多个视频链接，纯本地解析，不依赖网络，永远可用。
 *
 * 安全：所有外联请求都先过 isAllowedUrl 域名白名单 + parseSafeUrl 基础校验，
 * 并带超时与 UA，避免 SSRF 与长时间挂起。
 */

import { detectProvider } from '~/lib/video'
import type { VideoProvider } from '~/lib/video/types'
import { isAllowedUrl, parseSafeUrl } from '~/lib/security/url'
import type { Course, CourseEpisode, CourseSourceType } from './types'
import { courseIdFromSource } from './types'

/** 合集抓取允许访问的域名（比通用 VIDEO_HOSTS 更窄，仅接口与页面源站） */
const PLAYLIST_ALLOWED_HOSTS = [
  'api.bilibili.com',
  'www.bilibili.com',
  'space.bilibili.com',
  'bilibili.com',
  'm.bilibili.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
]

const FETCH_TIMEOUT_MS = 9000

export class PlaylistFetchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlaylistFetchError'
  }
}

interface PlaylistRef {
  platform: 'bilibili' | 'youtube'
  kind: 'bili-multipart' | 'bili-collection' | 'bili-space' | 'yt-playlist' | 'yt-channel'
  id: string
  /** 多P视频的完整 BV 链接（kind=bili-multipart 时携带，用于取分P数） */
  rawUrl?: string
}

function ensureHttps(raw: string): string {
  return raw.startsWith('http://') ? raw.replace('http://', 'https://') : raw
}

/** 识别合集/播放列表链接，返回结构化引用；无法识别返回 null */
export function detectPlaylist(rawUrl: string): PlaylistRef | null {
  const url = ensureHttps(rawUrl.trim())
  const u = parseSafeUrl(url, { allowHttp: true })
  if (!u) return null
  const host = u.hostname.toLowerCase()
  const isBili = host.endsWith('bilibili.com') || host.endsWith('b23.tv')
  const isYt = host.endsWith('youtube.com') || host.endsWith('youtu.be')

  if (isBili) {
    // 多P视频：/video/BVxxx?p=2 或 #page=2
    const bv = url.match(/bilibili\.com\/video\/(BV[0-9A-Za-z]+)/)
    if (bv) {
      return { platform: 'bilibili', kind: 'bili-multipart', id: bv[1], rawUrl: url }
    }
    // 合集：/list/ml123 或 /medialist/detail/ml123
    const ml = url.match(/ml(\d+)/)
    if (ml) {
      return { platform: 'bilibili', kind: 'bili-collection', id: ml[1] }
    }
    // 个人空间视频列表：/space/12345/video
    const mid = url.match(/space\.bilibili\.com\/(\d+)/)
    if (mid) {
      return { platform: 'bilibili', kind: 'bili-space', id: mid[1] }
    }
  }

  if (isYt) {
    const list = url.match(/[?&]list=([A-Za-z0-9_-]+)/)
    if (list) {
      return { platform: 'youtube', kind: 'yt-playlist', id: list[1] }
    }
    const channel = url.match(/youtube\.com\/(?:@[\w.-]+|channel\/UC[\w-]+)\/videos/)
    if (channel) {
      return { platform: 'youtube', kind: 'yt-channel', id: url }
    }
  }

  return null
}

async function fetchAllowed(target: string): Promise<string> {
  if (!isAllowedUrl(target, PLAYLIST_ALLOWED_HOSTS)) {
    throw new PlaylistFetchError('外联地址未通过域名白名单校验')
  }
  const safe = parseSafeUrl(target, { allowHttp: true })
  if (!safe) throw new PlaylistFetchError('外联地址不合法')
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(safe.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        Accept: 'application/json, text/html, */*',
      },
    })
    if (!res.ok) throw new PlaylistFetchError(`上游返回 ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function providerLabel(provider: VideoProvider | null): string {
  switch (provider) {
    case 'bilibili':
      return '哔哩哔哩'
    case 'youtube':
      return 'YouTube'
    case 'vimeo':
      return 'Vimeo'
    case 'direct':
      return '视频直链'
    default:
      return '视频'
  }
}

/** 解析 B站多P视频的分P，生成每一集链接 */
async function resolveBiliMultipart(ref: PlaylistRef): Promise<{ title: string; episodes: CourseEpisode[] }> {
  const bvid = ref.id
  const html = await fetchAllowed(`https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`)
  const data = JSON.parse(html)
  if (data?.code !== 0 || !Array.isArray(data?.data?.pages)) {
    throw new PlaylistFetchError('B站视频信息解析失败')
  }
  const pages: { page: number; part: string }[] = data.data.pages
  const title: string = data.data.title || bvid
  const episodes: CourseEpisode[] = pages.map((p, i) => ({
    url: `https://www.bilibili.com/video/${bvid}?p=${p.page}`,
    title: pages.length > 1 ? `${title}（P${p.page} ${p.part}）` : title,
    provider: 'bilibili',
    order: i + 1,
  }))
  return { title, episodes }
}

/** 解析 B站合集（收藏夹/歌单 ml） */
async function resolveBiliCollection(ref: PlaylistRef): Promise<{ title: string; episodes: CourseEpisode[] }> {
  const mediaId = ref.id
  const html = await fetchAllowed(
    `https://api.bilibili.com/x/v1/medialist/resource/list?media_id=${mediaId}&ps=30&pn=1`,
  )
  const data = JSON.parse(html)
  if (data?.code !== 0 || !Array.isArray(data?.data?.list)) {
    throw new PlaylistFetchError('B站合集解析失败（可能需要登录或接口受限）')
  }
  const list: { bvid: string; title: string }[] = data.data.list
  if (list.length === 0) throw new PlaylistFetchError('合集为空')
  const episodes: CourseEpisode[] = list.map((it, i) => ({
    url: `https://www.bilibili.com/video/${it.bvid}`,
    title: it.title || `第 ${i + 1} 集`,
    provider: 'bilibili',
    order: i + 1,
  }))
  const name: string = data.data.info?.name || 'B站合集'
  return { title: name, episodes }
}

/** 解析 YouTube 播放列表：抓取页面中的 videoId（best-effort，无需 API key） */
async function resolveYtPlaylist(ref: PlaylistRef): Promise<{ title: string; episodes: CourseEpisode[] }> {
  const html = await fetchAllowed(`https://www.youtube.com/playlist?list=${ref.id}`)
  const ids = new Set<string>()
  const re = /"videoId":"([A-Za-z0-9_-]{11})"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) ids.add(m[1])
  if (ids.size === 0) throw new PlaylistFetchError('未能从 YouTube 播放列表页解析到视频')
  const list = Array.from(ids)
  const episodes: CourseEpisode[] = list.map((vid, i) => ({
    url: `https://www.youtube.com/watch?v=${vid}&list=${ref.id}`,
    title: `第 ${i + 1} 集`,
    provider: 'youtube',
    order: i + 1,
  }))
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i)
  const title = titleMatch ? titleMatch[1].replace(/ - YouTube$/, '').trim() : 'YouTube 播放列表'
  return { title, episodes }
}

/**
 * 自动解析合集链接为课程章节。失败抛出 PlaylistFetchError。
 * 上层应 catch 后引导用户改用「逐条粘贴」的手动模式。
 */
export async function fetchPlaylistEpisodes(rawUrl: string): Promise<{ title: string; episodes: CourseEpisode[] }> {
  const ref = detectPlaylist(rawUrl)
  if (!ref) throw new PlaylistFetchError('无法识别为合集/播放列表链接')
  switch (ref.kind) {
    case 'bili-multipart':
      return resolveBiliMultipart(ref)
    case 'bili-collection':
      return resolveBiliCollection(ref)
    case 'yt-playlist':
      return resolveYtPlaylist(ref)
    // 空间/频道页需要登录态或更复杂的抓取，暂不支持自动解析
    case 'bili-space':
    case 'yt-channel':
      throw new PlaylistFetchError('该来源暂不支持自动解析，请改用逐条粘贴视频链接')
    default:
      throw new PlaylistFetchError('暂不支持的合集类型')
  }
}

/**
 * 纯函数：把多个视频链接构建为有序课程（手动模式）。
 * 不发起任何网络请求，永远可用；仅做格式与平台识别校验与去重。
 */
export function buildCourseFromUrls(urls: string[], sourceLabel = 'manual'): Course | null {
  const seen = new Set<string>()
  const episodes: CourseEpisode[] = []
  let order = 1
  for (const raw of urls) {
    const line = (raw || '').trim()
    if (!line) continue
    const url = ensureHttps(line)
    const u = parseSafeUrl(url, { allowHttp: true })
    if (!u) continue
    const provider = detectProvider(url)
    if (!provider) continue
    const key = url.replace(/[?#].*$/, '')
    if (seen.has(key)) continue
    seen.add(key)
    episodes.push({
      url,
      title: `${providerLabel(provider)} · 第 ${order} 集`,
      provider,
      order: order++,
    })
  }
  if (episodes.length === 0) return null
  const sourceType = (sourceLabel as CourseSourceType) || 'manual'
  return {
    id: courseIdFromSource(episodes.map((e) => e.url).join('|')),
    title: `我的课程（${episodes.length} 集）`,
    sourceUrl: '',
    sourceType,
    episodeCount: episodes.length,
    createdAt: Date.now(),
    episodes,
  }
}
