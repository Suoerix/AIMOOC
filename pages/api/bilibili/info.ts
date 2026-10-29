import type { NextApiRequest, NextApiResponse } from 'next'
import { biliHeaders, biliFetchRaw } from '~/lib/bilibili/server'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { bvid } = req.query

  if (!bvid) {
    return res.status(400).json({ error: 'Missing bvid parameter' })
  }

  try {
    const response = await biliFetchRaw(
      `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
      biliHeaders()
    )

    if (!response.ok) {
      throw new Error(`Bilibili API request failed: ${response.status}`)
    }

    const data = await response.json()
    if (data.code !== 0) {
      return res.status(404).json({ error: data.message || 'Video not found' })
    }
    res.status(200).json(data)
  } catch (error) {
    console.error('Error fetching video info:', error)
    res.status(500).json({ error: 'Failed to fetch video info' })
  }
}
