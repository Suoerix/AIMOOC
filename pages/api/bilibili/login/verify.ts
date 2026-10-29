import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyBiliCookie } from '~/lib/bilibili/server'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { cookie } = (req.body || {}) as { cookie?: string }

  if (!cookie || typeof cookie !== 'string') {
    return res.status(400).json({ error: 'Missing cookie parameter' })
  }

  const normalized = cookie.includes('SESSDATA') ? cookie : `SESSDATA=${cookie}`
  const user = await verifyBiliCookie(normalized)

  if (!user) {
    return res.status(200).json({ loggedIn: false })
  }

  res.status(200).json({ loggedIn: true, user, cookie: normalized })
}
