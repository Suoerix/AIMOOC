import type { NextApiRequest, NextApiResponse } from 'next'
import { getXfyunConfig, synthesizeToMp3 } from '~/lib/tts/xunfei'
import { LIMITS, normalizeExternalText } from '~/lib/security/input'
import { methodAllowed, rejectMethod, logInternalError, publicError, isBodyTooLarge } from '~/lib/security/request'

export const maxDuration = 30

/**
 * POST { text, vcn?, speed?, probe? } → { audio: base64(mp3), mime }
 * 未配置讯飞密钥时返回 501 { fallback: true }，前端回退到浏览器 speechSynthesis。
 * text ≤ LIMITS.ttsChars，vcn 仅允许 [A-Za-z0-9_-]，speed 限定 0.5~2.0。
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const { statusCode, body } = rejectMethod(['POST'])
    return res.status(statusCode).json(body)
  }
  if (isBodyTooLarge(req.body)) {
    return res.status(413).json({ errorMessage: '请求体过大' })
  }

  const { text, vcn, speed, probe } = (req.body || {}) as {
    text?: string
    vcn?: string
    speed?: number | string
    probe?: boolean
  }

  // 能力探测：前端据此决定用讯飞还是浏览器语音（保留 {probe:true} 行为）
  if (probe) {
    return res.status(200).json({ probe: true, configured: Boolean(getXfyunConfig()) })
  }

  const safeText = normalizeExternalText(text).slice(0, LIMITS.ttsChars).trim()
  if (!safeText) {
    return res.status(400).json({ errorMessage: 'text 不能为空' })
  }

  // vcn 白名单：只允许字母 / 数字 / 下划线 / 连字符
  let safeVcn: string | undefined
  if (vcn !== undefined && vcn !== null) {
    if (typeof vcn !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(vcn)) {
      return res.status(400).json({ errorMessage: 'vcn 参数不合法' })
    }
    safeVcn = vcn
  }

  // speed 作为倍率限定在 0.5~2.0，再映射到讯飞 0-100 刻度（默认 50 对应 1.0 倍）
  let xunfeiSpeed: number | undefined
  if (speed !== undefined && speed !== null && speed !== '') {
    const n = Number(speed)
    if (!Number.isFinite(n)) {
      return res.status(400).json({ errorMessage: 'speed 参数不合法' })
    }
    const clamped = Math.min(2, Math.max(0.5, n))
    xunfeiSpeed = Math.round(clamped * 50)
  }

  const config = getXfyunConfig()
  if (!config) {
    return res.status(501).json({ fallback: true, errorMessage: '讯飞 TTS 未配置，请使用浏览器语音回退' })
  }

  try {
    const mp3 = await synthesizeToMp3(safeText, config, {
      vcn: safeVcn,
      speed: xunfeiSpeed,
    })
    res.setHeader('Cache-Control', 'public, max-age=86400')
    return res.status(200).json({ audio: mp3.toString('base64'), mime: 'audio/mpeg' })
  } catch (error) {
    // 上游错误只在服务端记录，返回给客户端的一律是通用文案 + 回退标记
    logInternalError('tts', error)
    return res.status(502).json({ fallback: true, errorMessage: publicError('语音合成失败，请稍后重试') })
  }
}
