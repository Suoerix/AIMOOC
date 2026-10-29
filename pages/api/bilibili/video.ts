import type { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream'
import { biliFetchRaw, getPlayUrl } from '~/lib/bilibili/server'

export const maxDuration = 60

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  let url: string | undefined
  let cookie: string | undefined

  if (req.method === 'GET') {
    url = req.query.url as string
  } else if (req.method === 'POST') {
    url = req.body?.url
    cookie = req.body?.cookie
    // resolve 模式：只返回 CDN 直链，由浏览器直接播放（绕过服务端视频代理）
    if (url && req.body?.resolve === '1') {
      try {
        const { playUrl } = await getPlayUrl(url, cookie)
        return res.status(200).json({ playUrl })
      } catch (error) {
        console.error('Error resolving playurl:', error)
        return res.status(500).json({ error: 'Failed to resolve play url' })
      }
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    const { playUrl } = await getPlayUrl(url, cookie)
    const range = req.headers.range

    const upstream = await biliFetchRaw(playUrl, {
      'User-Agent': USER_AGENT,
      Referer: 'https://www.bilibili.com/',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(range ? { Range: range } : {}),
    })

    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({ error: 'Failed to fetch video' })
    }

    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'video/mp4')
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'no-store')
    for (const key of ['content-length', 'content-range']) {
      const value = upstream.headers.get(key)
      if (value) res.setHeader(key === 'content-length' ? 'Content-Length' : 'Content-Range', value)
    }
    res.status(upstream.status)

    Readable.fromWeb(upstream.body as any).pipe(res)
  } catch (error) {
    console.error('Error proxying video:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to fetch video' })
    } else {
      res.end()
    }
  }
}
