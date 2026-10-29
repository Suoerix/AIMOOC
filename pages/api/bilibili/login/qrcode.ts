import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const response = await fetch(
      'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: 'https://www.bilibili.com/',
        },
      }
    )

    const json = await response.json()
    if (json.code !== 0 || !json.data?.url || !json.data?.qrcode_key) {
      return res
        .status(502)
        .json({ error: 'Failed to generate qrcode', message: json.message })
    }

    res.status(200).json({
      url: json.data.url,
      qrcodeKey: json.data.qrcode_key,
    })
  } catch (error) {
    console.error('Error generating qrcode:', error)
    res.status(500).json({ error: 'Failed to generate qrcode' })
  }
}
