import type { NextApiRequest, NextApiResponse } from 'next'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { url } = req.query

  if (!url || typeof url !== 'string' || !url.includes('b23.tv')) {
    return res.status(400).json({ error: 'Invalid b23.tv url' })
  }

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    })

    if (!response.url || !response.url.includes('bilibili.com')) {
      return res.status(400).json({ error: 'Failed to resolve short url' })
    }

    res.status(200).json({ url: response.url })
  } catch (error) {
    console.error('Error resolving b23.tv url:', error)
    res.status(500).json({ error: 'Failed to resolve short url' })
  }
}
