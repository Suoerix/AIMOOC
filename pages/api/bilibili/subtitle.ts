import type { NextApiRequest, NextApiResponse } from 'next'
import { fetchSubtitles } from '~/lib/bilibili/server'
import { getBiliSession } from '~/lib/bilibili/session'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'
import { LIMITS } from '~/lib/security/input'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const r = rejectMethod(['POST'])
    return res.status(r.statusCode).json(r.body)
  }

  // 只读取 url；彻底忽略 req.body.cookie，凭证一律取服务端会话
  const { url } = (req.body || {}) as { url?: unknown }
  if (!url || typeof url !== 'string' || url.length > LIMITS.urlChars) {
    return res.status(400).json({ error: 'Missing or invalid url parameter' })
  }

  try {
    const cookie = getBiliSession(req)
    const subtitles = await fetchSubtitles(url, cookie)
    if (!subtitles.length) {
      return res.status(501).json({ error: 'No subtitles found' })
    }
    return res.status(200).json(subtitles)
  } catch (error) {
    logInternalError('bilibili/subtitle', error)
    return res.status(500).json({ error: publicError() })
  }
}
