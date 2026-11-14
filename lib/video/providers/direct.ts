/**
 * 直链视频适配：识别 .mp4 / .webm / .ogg / .m3u8 媒体文件。
 * 服务端不发起任何外联，playUrl 原样回显给前端播放器，字幕走手动通道。
 */

import { parseSafeUrl } from '~/lib/security/url'
import type { ResolvedVideo, ResolveOptions } from '~/lib/video/types'

const MANUAL_NOTICE = '直链视频没有内嵌字幕，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'

export async function resolveDirect(rawUrl: string, _options: ResolveOptions): Promise<ResolvedVideo> {
  const u = parseSafeUrl(rawUrl, { allowHttp: true })
  let filename = '直链视频'
  let id = rawUrl
  if (u) {
    const seg = u.pathname.split('/').filter(Boolean)
    const last = seg[seg.length - 1]
    if (last) {
      try {
        filename = decodeURIComponent(last)
      } catch {
        filename = last
      }
    }
    id = u.pathname
  }

  return {
    meta: {
      provider: 'direct',
      id,
      title: filename,
      playUrl: rawUrl,
      sourceUrl: rawUrl,
      transcriptMode: 'manual',
    },
    transcript: [],
    transcriptSource: 'none',
    needsManualTranscript: true,
    notice: MANUAL_NOTICE,
  }
}
