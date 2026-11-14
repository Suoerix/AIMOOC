/**
 * POST { url } -> ResolvedVideo
 * 视频链接解析入口：方法 / 长度 / 基础安全 / 平台白名单校验后交给适配层。
 * 需要服务端外联的平台必须落在 VIDEO_HOSTS 白名单内；内部错误一律脱敏。
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import { LIMITS } from '~/lib/security/input'
import { isBodyTooLarge, logInternalError, methodAllowed, publicError, rejectMethod } from '~/lib/security/request'
import { isAllowedUrl, parseSafeUrl, VIDEO_HOSTS } from '~/lib/security/url'
import { getBiliSession } from '~/lib/bilibili/session'
import { detectProvider, resolveVideo } from '~/lib/video'

export const maxDuration = 30

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const rejected = rejectMethod(['POST'])
    return res.status(rejected.statusCode).json(rejected.body)
  }

  try {
    if (isBodyTooLarge(req.body)) {
      return res.status(413).json({ errorMessage: '请求体过大' })
    }
    const { url } = (req.body || {}) as { url?: unknown }
    if (typeof url !== 'string' || !url.trim() || url.length > LIMITS.urlChars) {
      return res.status(400).json({ errorMessage: '视频地址不合法或过长' })
    }
    const raw = url.trim()
    const provider = detectProvider(raw)

    // 基础安全校验：拒绝内网 / 非 http(s) / userinfo / 非标准端口
    if (!parseSafeUrl(raw, { allowHttp: true })) {
      return res.status(400).json({ errorMessage: '视频地址不合法' })
    }
    // 需要服务端外联的平台必须落在 VIDEO_HOSTS 白名单内；
    // 直链不发起服务端外联（playUrl 交给前端播放器），只需通过基础安全校验。
    if (provider !== 'direct' && !isAllowedUrl(raw, VIDEO_HOSTS)) {
      return res.status(400).json({ errorMessage: '该视频平台暂不支持' })
    }

    // B 站凭证只从 httpOnly 会话 Cookie 读取，忽略请求体里可能伪造的字段
    const cookie = provider === 'bilibili' ? getBiliSession(req) : undefined
    const resolved = await resolveVideo(raw, { cookie })
    return res.status(200).json(resolved)
  } catch (error) {
    logInternalError('api/video/resolve', error)
    return res.status(500).json({ errorMessage: publicError() })
  }
}
