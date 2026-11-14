import type { NextApiRequest, NextApiResponse } from 'next'
import { Readable } from 'stream'
import { biliFetchRaw, getPlayUrl } from '~/lib/bilibili/server'
import { getBiliSession } from '~/lib/bilibili/session'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'
import { LIMITS } from '~/lib/security/input'
import { isAllowedUrl, BILIBILI_HOSTS } from '~/lib/security/url'

export const maxDuration = 60

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET', 'POST'])) {
    const r = rejectMethod(['GET', 'POST'])
    return res.status(r.statusCode).json(r.body)
  }

  const rawUrl: unknown = req.method === 'GET' ? req.query.url : req.body?.url
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > LIMITS.urlChars) {
    return res.status(400).json({ error: 'Missing or invalid url parameter' })
  }
  const url = rawUrl

  // 凭证只从 httpOnly 会话读取，彻底忽略 req.body.cookie
  const cookie = getBiliSession(req)
  const resolveOnly = req.method === 'POST' && req.body?.resolve === '1'

  try {
    const { playUrl } = await getPlayUrl(url, cookie)
    // playUrl 由上游返回，解析 / 代理前必须落在 B 站白名单内且非私网
    if (!isAllowedUrl(playUrl, BILIBILI_HOSTS)) {
      return res.status(502).json({ error: publicError() })
    }

    // resolve 模式：只返回校验过的 CDN 直链，由浏览器直连播放
    if (resolveOnly) {
      return res.status(200).json({ playUrl })
    }

    // 只转发格式合法的 Range，避免把任意请求头注入上游
    const rangeHeader = req.headers.range
    const range =
      typeof rangeHeader === 'string' && /^bytes=\d*-\d*(,\s*\d*-\d*)*$/.test(rangeHeader) ? rangeHeader : undefined

    const upstream = await biliFetchRaw(playUrl, {
      'User-Agent': USER_AGENT,
      Referer: 'https://www.bilibili.com/',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(range ? { Range: range } : {}),
    })

    if (!upstream.ok || !upstream.body) {
      return res.status(502).json({ error: publicError() })
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
    logInternalError('bilibili/video', error)
    if (!res.headersSent) {
      return res.status(500).json({ error: publicError() })
    }
    res.end()
  }
}
