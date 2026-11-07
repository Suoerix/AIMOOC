import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { peekQuota, QUOTA_LIMITS, type QuotaTier } from '~/lib/quota'

export const maxDuration = 15

/**
 * GET → { tier, generate: {limit, remaining}, chat: {limit, remaining} }
 * 前端用来展示「今日剩余额度」，登录用户额度更高。
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const forwarded = req.headers['x-forwarded-for']
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    '127.0.0.1'

  let tier: QuotaTier = 'anon'
  let key = `ip:${ip}`
  let email: string | null = null

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const supabase = createServerSupabaseClient({ req, res })
      const {
        data: { session },
      } = await supabase.auth.getSession()
      email = session?.user?.email ?? null
      if (email) {
        tier = 'user'
        key = email.toLowerCase()
      }
    } catch {
      /* 匿名 */
    }
  }

  const [generate, chat] = await Promise.all([
    peekQuota(tier, 'generate', key),
    peekQuota(tier, 'chat', key),
  ])

  return res.status(200).json({
    tier,
    email,
    unlimited: generate.unlimited,
    generate: { limit: generate.limit, remaining: generate.remaining },
    chat: { limit: chat.limit, remaining: chat.remaining },
    limits: QUOTA_LIMITS,
  })
}
