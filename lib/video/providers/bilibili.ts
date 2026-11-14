/**
 * 哔哩哔哩适配：复用既有 lib/bilibili/server.ts 的元数据与字幕能力，
 * 转换为统一 TranscriptItem[]，保持自动字幕优势。
 */

import { extractBvid, fetchSubtitles, getVideoMeta } from '~/lib/bilibili/server'
import { BILIBILI_HOSTS, isAllowedUrl } from '~/lib/security/url'
import type { ResolvedVideo, ResolveOptions, TranscriptItem } from '~/lib/video/types'

const NO_SUBTITLE_NOTICE = '该视频暂无可用字幕，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'

export async function resolveBilibili(rawUrl: string, options: ResolveOptions): Promise<ResolvedVideo> {
  // 既有 server.ts 内部会自行外联 B 站 API，这里先做入口白名单校验
  if (!isAllowedUrl(rawUrl, BILIBILI_HOSTS)) {
    throw new Error('B 站地址未通过白名单校验')
  }
  const bvid = extractBvid(rawUrl) || ''
  let title = '哔哩哔哩视频'

  // 元数据失败不阻断字幕获取，二者各自降级
  try {
    const meta = await getVideoMeta(rawUrl, options.cookie)
    if (meta.title) title = meta.title
  } catch {
    // 标题保留占位，字幕仍继续尝试
  }

  let transcript: TranscriptItem[] = []
  let source = 'none'
  try {
    const subtitles = await fetchSubtitles(rawUrl, options.cookie)
    // 多语言字幕优先取中文轨道，否则取第一条
    const chosen = subtitles.find((group) => /zh|cn|中文/i.test(group.lan || '')) || subtitles[0]
    if (chosen && Array.isArray(chosen.subtitle)) {
      transcript = chosen.subtitle
        .map((item) => ({
          from: Number(item.from) || 0,
          to: Number(item.to) || 0,
          content: String(item.content == null ? '' : item.content).trim(),
        }))
        .filter((item) => item.content.length > 0)
        .sort((a, b) => a.from - b.from)
      if (transcript.length) source = 'bilibili:' + (chosen.lan || 'auto')
    }
  } catch {
    transcript = []
  }

  const hasTranscript = transcript.length > 0
  return {
    meta: {
      provider: 'bilibili',
      id: bvid || rawUrl,
      title,
      embedUrl: bvid
        ? 'https://player.bilibili.com/player.html?bvid=' + encodeURIComponent(bvid) + '&page=1'
        : undefined,
      sourceUrl: rawUrl,
      transcriptMode: hasTranscript ? 'auto' : 'manual',
    },
    transcript,
    transcriptSource: source,
    needsManualTranscript: !hasTranscript,
    notice: hasTranscript ? undefined : NO_SUBTITLE_NOTICE,
  }
}
