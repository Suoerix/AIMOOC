import type { NextApiRequest, NextApiResponse } from 'next'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'
import { LIMITS } from '~/lib/security/input'
import { safeResolveRedirect, BILIBILI_HOSTS } from '~/lib/security/url'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const r = rejectMethod(['GET'])
    return res.status(r.statusCode).json(r.body)
  }

  const { url } = req.query
  if (!url || typeof url !== 'string' || url.length > LIMITS.urlChars || !url.includes('b23.tv')) {
    return res.status(400).json({ error: 'Invalid b23.tv url' })
  }

  try {
    // 逐跳跟随并逐跳校验域名，替代 fetch(redirect:'follow') + includes 的可绕过写法
    const resolved = await safeResolveRedirect(url, BILIBILI_HOSTS)
    if (!resolved) {
      return res.status(400).json({ error: 'Failed to resolve short url' })
    }
    return res.status(200).json({ url: resolved.toString() })
  } catch (error) {
    logInternalError('b23tv', error)
    return res.status(500).json({ error: publicError() })
  }
}
