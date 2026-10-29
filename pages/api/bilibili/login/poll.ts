import type { NextApiRequest, NextApiResponse } from 'next'
import { biliHeaders, verifyBiliCookie, BiliUser } from '~/lib/bilibili/server'

const PASSPORT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function extractCookies(setCookies: string[]): string {
  return setCookies
    .map((raw) => raw.split(';')[0].trim())
    .filter((kv) => /^[A-Za-z0-9_]+=./.test(kv))
    .join('; ')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { key } = req.query

  if (!key || typeof key !== 'string') {
    return res.status(400).json({ error: 'Missing key parameter' })
  }

  try {
    const response = await fetch(
      `https://passport.bilibili.com/x/passport-login/web/qrcode/poll?qrcode_key=${encodeURIComponent(key)}`,
      {
        headers: {
          'User-Agent': PASSPORT_UA,
          Referer: 'https://www.bilibili.com/',
        },
      }
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
      return res
        .status(502)
        .json({ error: json?.data?.message || json?.message || 'Poll failed' })
    }

    const headers = response.headers as Headers & { getSetCookie?: () => string[] }
    const setCookies =
      typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : []
    const cookie = extractCookies(setCookies)

    if (!cookie.includes('SESSDATA')) {
      return res
        .status(502)
        .json({ error: 'Login succeeded but no session cookie returned' })
    }

    let user: BiliUser | null = null
    try {
      user = await verifyBiliCookie(cookie)
    } catch (e) {
      console.error('Error verifying login:', e)
    }

    res.status(200).json({ status: 'success', cookie, user })
  } catch (error) {
    console.error('Error polling qrcode:', error)
    res.status(500).json({ error: 'Poll failed' })
  }
}
