import type { NextApiRequest, NextApiResponse } from 'next'
import { biliHeaders, biliFetchRaw } from '~/lib/bilibili/server'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const result: Record<string, unknown> = {
    ipCountry: req.headers['x-vercel-ip-country'] || null,
    region: process.env.VERCEL_REGION || null,
    bilibiliProxy: process.env.BILIBILI_PROXY ? 'configured' : 'not set',
  }

  try {
    const response = await biliFetchRaw(
      'https://api.bilibili.com/x/web-interface/view?bvid=BV1GJ411x7h7',
      biliHeaders(),
      { withBuvid: true }
    )
    const text = await response.text()
    result.upstreamStatus = response.status
    result.buvidAttached = !!req.headers.cookie || true
    result.bodySnippet = text.slice(0, 300)
  } catch (error: any) {
    result.fetchError = {
      name: error?.name,
      message: error?.message,
      cause: String(error?.cause || ''),
    }
  }

  res.status(200).json(result)
}
