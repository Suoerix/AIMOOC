import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyBiliCookie, fetchWithTimeout } from '~/lib/bilibili/server'
import { setBiliSession } from '~/lib/bilibili/session'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'
import { LIMITS } from '~/lib/security/input'

const PASSPORT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function extractCookies(setCookies: string[]): string {
  return setCookies
    .map((raw) => raw.split(';')[0].trim())
    .filter((kv) => /^[A-Za-z0-9_]+=./.test(kv))
    .join('; ')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const r = rejectMethod(['GET'])
    return res.status(r.statusCode).json(r.body)
  }

  const { key } = req.query
  if (!key || typeof key !== 'string' || key.length > LIMITS.urlChars) {
    return res.status(400).json({ error: 'Missing or invalid key parameter' })
  }

  try {
    const response = await fetchWithTimeout(
      `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`,
      {
        headers: {
          'User-Agent': PASSPORT_UA,
          Referer: 'https://www.bilibili.com/',
        },
      },
    )

    const json = await response.json()
    const innerCode = json?.data?.code ?? json?.code

    if (innerCode === 86101) {
      return res.status(200).json({ status: 'waiting' })
    }
    if (innerCode === 86090) {
      return res.status(200).json({ status: 'scanned' })
    }
    if (innerCode === 86038 || innerCode === 86083) {
      return res.status(200).json({ status: 'expired' })
    }
    if (innerCode !== 0) {
      // 不回显上游 message
      return res.status(502).json({ error: publicError() })
    }

    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
    const cookie = extractCookies(setCookies)

    if (!cookie.includes('SESSDATA')) {
      return res.status(502).json({ error: publicError() })
    }

    // 凭证只写入 httpOnly 会话 Cookie，绝不回传浏览器
    if (!setBiliSession(res, cookie)) {
      return res.status(500).json({ error: publicError() })
    }

    // 用户信息仅用于展示；nav 接口临时不可用时用空值兜底，不影响登录态写入
    const user = await verifyBiliCookie(cookie)
    return res.status(200).json({
      status: 'success',
      user: user ? { mid: user.mid, uname: user.uname, avatar: user.face } : { mid: 0, uname: '', avatar: '' },
    })
  } catch (error) {
    logInternalError('bilibili/login/poll', error)
    return res.status(500).json({ error: publicError() })
  }
}
