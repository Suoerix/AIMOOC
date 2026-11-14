import type { NextApiRequest, NextApiResponse } from 'next'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'
import { fetchWithTimeout } from '~/lib/bilibili/server'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const r = rejectMethod(['GET'])
    return res.status(r.statusCode).json(r.body)
  }

  try {
    const response = await fetchWithTimeout('https://passport.bilibili.com/x/passport-login/web/qrcode/generate', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://www.bilibili.com/',
      },
    })
    if (!response.ok) {
      throw new Error(`qrcode generate failed: ${response.status}`)
    }

    const json = await response.json()
    if (json.code !== 0 || !json.data?.url || !json.data?.qrcode_key) {
      // 不回显上游 message
      return res.status(502).json({ error: publicError() })
    }

    return res.status(200).json({
      url: json.data.url,
      qrcodeKey: json.data.qrcode_key,
    })
  } catch (error) {
    logInternalError('bilibili/login/qrcode', error)
    return res.status(500).json({ error: publicError() })
  }
}
