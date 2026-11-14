/**
 * Vimeo 适配：oEmbed 取元数据，字幕走手动通道。
 */

import { safeVideoFetch, VIMEO_HOSTS } from '~/lib/video/types'
import type { ResolvedVideo, ResolveOptions } from '~/lib/video/types'

const MANUAL_NOTICE = 'Vimeo 未提供公开字幕接口，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'

interface VimeoOEmbed {
  title?: string
  author_name?: string
  duration?: number
  thumbnail_url?: string
  video_id?: number | string
}

function extractVimeoId(rawUrl: string): string {
  try {
    const u = new URL(rawUrl)
    const seg = u.pathname.split('/').filter(Boolean)
    // /123456789、/video/123456789、/channels/xxx/123456789
    const numeric = seg.filter((s) => /^\d{6,}$/.test(s)).pop()
    return numeric || seg[seg.length - 1] || ''
  } catch {
    return ''
  }
}

export async function resolveVimeo(rawUrl: string, _options: ResolveOptions): Promise<ResolvedVideo> {
  let id = extractVimeoId(rawUrl)
  let title = 'Vimeo 视频'
  let author: string | undefined
  let durationSec: number | undefined
  let thumbnail: string | undefined

  try {
    const endpoint = 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(rawUrl)
    const response = await safeVideoFetch(endpoint, VIMEO_HOSTS)
    if (response.ok) {
      const data = (await response.json()) as VimeoOEmbed
      if (typeof data.title === 'string' && data.title) title = data.title.slice(0, 200)
      if (typeof data.author_name === 'string') author = data.author_name.slice(0, 120)
      if (typeof data.thumbnail_url === 'string') thumbnail = data.thumbnail_url
      const dur = Number(data.duration)
      if (isFinite(dur) && dur > 0) durationSec = Math.floor(dur)
      if (data.video_id != null && String(data.video_id)) id = String(data.video_id)
    }
  } catch {
    // oEmbed 不可用时保留从 URL 提取的 id 与占位标题
  }

  return {
    meta: {
      provider: 'vimeo',
      id: id || rawUrl,
      title,
      author,
      durationSec,
      thumbnail,
      embedUrl: id ? 'https://player.vimeo.com/video/' + encodeURIComponent(id) : undefined,
      sourceUrl: rawUrl,
      transcriptMode: 'manual',
    },
    transcript: [],
    transcriptSource: 'none',
    needsManualTranscript: true,
    notice: MANUAL_NOTICE,
  }
}
