import type { NextRequest } from 'next/server'
import { getPlayUrl } from '~/lib/bilibili/server'

export const config = { runtime: 'edge' }

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function json(error: string, status: number) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export default async function handler(req: NextRequest) {
  let url: string | undefined
  let cookie: string | undefined

  if (req.method === 'GET') {
    url = req.nextUrl.searchParams.get('url') || undefined
  } else if (req.method === 'POST') {
    const body = (await req.json()) as { url?: string; cookie?: string }
    url = body.url
    cookie = body.cookie
  } else {
    return json('Method not allowed', 405)
  }

  if (!url) {
    return json('Missing url parameter', 400)
  }

  try {
    const { playUrl } = await getPlayUrl(url, cookie)
    const range = req.headers.get('range')

    const upstream = await fetch(playUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Referer: 'https://www.bilibili.com/',
        ...(cookie ? { Cookie: cookie } : {}),
        ...(range ? { Range: range } : {}),
      },
    })

    if (!upstream.ok || !upstream.body) {
      return json('Failed to fetch video', 502)
    }

    const headers = new Headers({
      'content-type': upstream.headers.get('content-type') || 'video/mp4',
      'accept-ranges': 'bytes',
      'cache-control': 'no-store',
    })
    for (const key of ['content-length', 'content-range']) {
      const value = upstream.headers.get(key)
      if (value) headers.set(key, value)
    }

    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    console.error('Error proxying video:', error)
    return json('Failed to fetch video', 500)
  }
}
