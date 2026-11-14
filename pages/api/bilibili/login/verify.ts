import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyBiliCookie } from '~/lib/bilibili/server'
import { setBiliSession, normalizeBiliCookie } from '~/lib/bilibili/session'
import { methodAllowed, rejectMethod, logInternalError, publicError, isBodyTooLarge } from '~/lib/security/request'
import { LIMITS } from '~/lib/security/input'

/**
 * 手动填入凭证的入口：此处 req.body.cookie 是用户主动提交的登录凭证，
 * 与业务接口（subtitle/video/info/notes）里被当作代理凭证的 body.cookie 不同。
 * 校验通过后仅写入 httpOnly 会话 Cookie，不再回传给浏览器。
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const r = rejectMethod(['POST'])
    return res.status(r.statusCode).json(r.body)
  }
  if (isBodyTooLarge(req.body)) {
    return res.status(413).json({ error: '请求体过大' })
  }

  const { cookie } = (req.body || {}) as { cookie?: unknown }
  if (!cookie || typeof cookie !== 'string' || cookie.length > LIMITS.cookieChars) {
    return res.status(400).json({ error: 'Missing or invalid cookie parameter' })
  }

  // 兼容「纯 SESSDATA 值」与「完整 Cookie 串」两种输入，并做格式规范化
  const raw = cookie.includes('SESSDATA') ? cookie : `SESSDATA=${cookie}`
  const normalized = normalizeBiliCookie(raw)
  if (!normalized) {
    return res.status(400).json({ error: '凭证格式不正确' })
  }

  try {
    const user = await verifyBiliCookie(normalized)
    if (!user) {
      return res.status(200).json({ loggedIn: false })
    }
    if (!setBiliSession(res, normalized)) {
      return res.status(500).json({ error: publicError() })
    }
    return res.status(200).json({
      status: 'success',
      user: { mid: user.mid, uname: user.uname, avatar: user.face },
    })
  } catch (error) {
    logInternalError('bilibili/login/verify', error)
    return res.status(500).json({ error: publicError() })
  }
}
