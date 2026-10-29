import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchSubtitles } from '~/lib/bilibili/server'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url, cookie } = req.body || {}

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    const subtitles = await fetchSubtitles(url, cookie)
    if (!subtitles.length) {
      return res.status(501).json({ error: 'No subtitles found' })
    }
    res.status(200).json(subtitles)
  } catch (error) {
    console.error('Error fetching subtitles:', error)
    res.status(500).json({ error: 'Failed to fetch subtitles' })
  }
}
