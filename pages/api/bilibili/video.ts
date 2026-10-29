import type { NextRequest } from 'next/server'
import { getPlayUrl } from '~/lib/bilibili/server'

export const config = { runtime: 'edge' }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export default async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    const { url, cookie } = (await req.json()) as { url?: string; cookie?: string }
    if (!url) {
      return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      })
    }

    const { playUrl } = await getPlayUrl(url, cookie)
    const upstream = await fetch(playUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.bilibili.com/',
        ...(cookie ? { Cookie: cookie } : {}),
      },
    })

    if (!upstream.ok || !upstream.body) {
      return new Response(JSON.stringify({ error: 'Failed to fetch video' }), {
        status: 502,
        headers: { 'content-type': 'application/json' },
      })
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'video/mp4',
        'cache-control': 'no-store',
      },
    })
  } catch (error) {
    console.error('Error proxying video:', error)
    return new Response(JSON.stringify({ error: 'Failed to fetch video' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
}
