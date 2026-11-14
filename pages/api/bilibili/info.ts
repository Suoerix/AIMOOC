import type { NextApiRequest, NextApiResponse } from 'next'
import { biliHeaders, biliFetchRaw } from '~/lib/bilibili/server'
import { getBiliSession } from '~/lib/bilibili/session'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'
import { LIMITS } from '~/lib/security/input'

const BVID_RE = /^BV[a-zA-Z0-9]+$/

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const r = rejectMethod(['GET'])
    return res.status(r.statusCode).json(r.body)
  }

  const { bvid } = req.query
  if (!bvid || typeof bvid !== 'string' || bvid.length > LIMITS.urlChars || !BVID_RE.test(bvid)) {
    return res.status(400).json({ error: 'Missing or invalid bvid parameter' })
  }

  try {
    // 凭证只从 httpOnly 会话读取，忽略客户端可能伪造的 cookie 字段
    const cookie = getBiliSession(req)
    const response = await biliFetchRaw(
      `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
      biliHeaders(cookie),
      { withBuvid: true },
    )

    if (!response.ok) {
      throw new Error(`Bilibili API request failed: ${response.status}`)
    }

    const data = await response.json()
    if (data.code !== 0) {
      // 不回显上游业务错误信息
      return res.status(404).json({ error: publicError('Video not found') })
    }
    return res.status(200).json(data)
  } catch (error) {
    logInternalError('bilibili/info', error)
    return res.status(500).json({ error: publicError() })
  }
}
