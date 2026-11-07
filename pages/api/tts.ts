import type { NextApiRequest, NextApiResponse } from 'next'
import { getXfyunConfig, synthesizeToMp3 } from '~/lib/tts/xunfei'

export const maxDuration = 30

/**
 * POST { text, vcn?, speed? } → { audio: base64(mp3), mime }
 * 未配置讯飞密钥时返回 501 { fallback: true }，前端回退到浏览器 speechSynthesis。
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const { text, vcn, speed, probe } = (req.body || {}) as {
    text?: string
    vcn?: string
    speed?: number
    probe?: boolean
  }

  // 能力探测：前端据此决定用讯飞还是浏览器语音
  if (probe || !text || !text.trim()) {
    return res.status(200).json({ probe: true, configured: Boolean(getXfyunConfig()) })
  }

  const config = getXfyunConfig()
  if (!config) {
    return res
      .status(501)
      .json({ fallback: true, errorMessage: '讯飞 TTS 未配置，请使用浏览器语音回退' })
  }

  try {
    const mp3 = await synthesizeToMp3(text, config, { vcn, speed })
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.status(200).json({ audio: mp3.toString('base64'), mime: 'audio/mpeg' })
  } catch (error: any) {
    console.error('TTS error:', error?.message)
    return res
      .status(502)
      .json({ fallback: true, errorMessage: `语音合成失败: ${error?.message || '未知错误'}` })
  }
}
