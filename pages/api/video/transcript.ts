/**
 * POST { text?, format?, url? } -> { transcript: TranscriptItem[] }
 * text 为字幕文本；url 为白名单内的字幕文件地址，由服务端带超时拉取后解析。
 * 输入统一受 LIMITS.transcriptChars 约束，内部错误一律脱敏。
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { LIMITS, normalizeExternalText } from '~/lib/security/input'
import { isBodyTooLarge, logInternalError, methodAllowed, publicError, rejectMethod } from '~/lib/security/request'
import { isAllowedUrl, VIDEO_HOSTS } from '~/lib/security/url'
import { safeVideoFetch } from '~/lib/video/types'
import type { TranscriptItem } from '~/lib/video/types'
import { parseSubtitleText } from '~/utils/subtitleParser'

export const maxDuration = 20

type SubtitleFormat = 'auto' | 'srt' | 'vtt' | 'text'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const rejected = rejectMethod(['POST'])
    return res.status(rejected.statusCode).json(rejected.body)
  }

  try {
    if (isBodyTooLarge(req.body)) {
      return res.status(413).json({ errorMessage: '请求体过大' })
    }
    const { text, format, url } = (req.body || {}) as {
      text?: unknown
      format?: unknown
      url?: unknown
    }
    const fmt: SubtitleFormat =
      format === 'srt' || format === 'vtt' || format === 'text' || format === 'auto' ? format : 'auto'

    let raw = ''
    if (typeof text === 'string' && text.trim()) {
      if (text.length > LIMITS.transcriptChars) {
        return res.status(413).json({ errorMessage: `字幕文本最多 ${LIMITS.transcriptChars} 字` })
      }
      raw = normalizeExternalText(text, LIMITS.transcriptChars)
    } else if (typeof url === 'string' && url.trim()) {
      // 服务端外联拉取字幕文件：必须先过白名单，且由 safeVideoFetch 限时
      if (!isAllowedUrl(url, VIDEO_HOSTS)) {
        return res.status(400).json({ errorMessage: '字幕地址不在允许的域名内' })
      }
      const response = await safeVideoFetch(url, VIDEO_HOSTS)
      if (!response.ok) {
        return res.status(502).json({ errorMessage: '字幕文件拉取失败' })
      }
      raw = normalizeExternalText(await response.text(), LIMITS.transcriptChars)
    } else {
      return res.status(400).json({ errorMessage: '请提供字幕文本或字幕文件地址' })
    }

    if (!raw.trim()) {
      return res.status(400).json({ errorMessage: '字幕内容为空' })
    }
    const transcript: TranscriptItem[] = parseSubtitleText(raw, fmt)
    return res.status(200).json({ transcript })
  } catch (error) {
    logInternalError('api/video/transcript', error)
    return res.status(500).json({ errorMessage: publicError() })
  }
}
