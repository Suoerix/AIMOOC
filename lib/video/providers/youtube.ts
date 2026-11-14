/**
 * YouTube 适配：oEmbed 取标题 / 作者，自动获取字幕（youtube-transcript 优先，
 * 公开 timedtext 兜底）。任何失败都降级为手动通道并返回中文提示，绝不向外抛出。
 */

import YoutubeTranscript from 'youtube-transcript'
import { parseSubtitleText } from '~/utils/subtitleParser'
import { safeVideoFetch, YOUTUBE_HOSTS } from '~/lib/video/types'
import type { ResolvedVideo, ResolveOptions, TranscriptItem } from '~/lib/video/types'

const MANUAL_NOTICE = '未能自动获取 YouTube 字幕，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'

interface OEmbed {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

/** 从 watch / youtu.be / shorts / embed / live 等常见形态里提取视频 ID */
export function extractYoutubeId(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.toLowerCase()
    if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
      return (u.pathname.split('/')[1] || '').slice(0, 32)
    }
    const v = u.searchParams.get('v')
    if (v) return v.slice(0, 32)
    const m = u.pathname.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/)
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

/** 通过 youtube-transcript 拉取中文字幕，失败返回空数组 */
async function fetchYoutubeTranscript(videoId: string): Promise<TranscriptItem[]> {
  try {
    const items = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'zh' })
    return items
      .map((it) => ({
        from: Math.max(0, Math.round(it.offset / 1000)),
        to: Math.max(0, Math.round((it.offset + it.duration) / 1000)),
        content: it.text,
      }))
      .filter((it) => it.content && it.content.trim())
  } catch {
    return []
  }
}

/** 兜底：公开 timedtext 接口 */
async function fetchTimedtext(videoId: string): Promise<TranscriptItem[]> {
  try {
    const timed =
      'https://www.youtube.com/api/timedtext?v=' + encodeURIComponent(videoId) + '&lang=zh&fmt=vtt'
    const response = await safeVideoFetch(timed, YOUTUBE_HOSTS)
    if (response.ok) {
      const body = await response.text()
      if (body && body.trim() && body.indexOf('<transcript') === -1) {
        return parseSubtitleText(body, 'vtt')
      }
    }
  } catch {
    // 忽略，降级
  }
  return []
}

export async function resolveYoutube(rawUrl: string, _options: ResolveOptions): Promise<ResolvedVideo> {
  const videoId = extractYoutubeId(rawUrl)
  let title = 'YouTube 视频'
  let author: string | undefined
  let thumbnail: string | undefined

  // 1) oEmbed 获取标题 / 作者 / 缩略图
  try {
    const endpoint = 'https://www.youtube.com/oembed?url=' + encodeURIComponent(rawUrl) + '&format=json'
    const response = await safeVideoFetch(endpoint, YOUTUBE_HOSTS)
    if (response.ok) {
      const data = (await response.json()) as OEmbed
      if (typeof data.title === 'string' && data.title) title = data.title.slice(0, 200)
      if (typeof data.author_name === 'string') author = data.author_name.slice(0, 120)
      if (typeof data.thumbnail_url === 'string') thumbnail = data.thumbnail_url
    }
  } catch {
    // oEmbed 不可用时保留占位标题，继续尝试字幕
  }

  // 2) 自动字幕：youtube-transcript 优先，timedtext 兜底
  let transcript: TranscriptItem[] = []
  if (videoId) {
    transcript = await fetchYoutubeTranscript(videoId)
    if (!transcript.length) transcript = await fetchTimedtext(videoId)
  }

  const hasTranscript = transcript.length > 0
  return {
    meta: {
      provider: 'youtube',
      id: videoId || rawUrl,
      title,
      author,
      thumbnail,
      embedUrl: videoId ? 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(videoId) : undefined,
      sourceUrl: rawUrl,
      transcriptMode: hasTranscript ? 'auto' : 'manual',
    },
    transcript,
    transcriptSource: hasTranscript ? 'youtube-transcript' : 'none',
    needsManualTranscript: !hasTranscript,
    notice: hasTranscript ? undefined : MANUAL_NOTICE,
  }
}
