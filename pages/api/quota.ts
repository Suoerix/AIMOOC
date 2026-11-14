import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { peekQuota, QUOTA_LIMITS, type QuotaTier } from '~/lib/quota'
import { isSupabaseConfigured } from '~/lib/supabase/client'
import { clientIpKey, methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'

export const maxDuration = 15

/**
 * GET → { tier, generate: {limit, remaining}, chat: {limit, remaining}, ... }
 * 前端用来展示「今日剩余额度」，登录用户额度更高。
 * 计数 key 与 middleware 保持一致：匿名用 clientIpKey，登录用 user.id。
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const rejected = rejectMethod(['GET'])
    return res.status(rejected.statusCode).json(rejected.body)
  }

  let tier: QuotaTier = 'anon'
  // 匿名 key 用不可伪造的 IP 摘要，与 middleware 的 resolveIdentity 一致
  let key = clientIpKey(req)
  let email: string | null = null

  if (isSupabaseConfigured()) {
    try {
      const supabase = createServerSupabaseClient({ req, res })
      // getUser() 会向 Auth 服务器验签，禁止用 getSession() 读 cookie 里的伪造身份
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error) logInternalError('quota.getUser', error)
      if (user?.id) {
        tier = 'user'
        // 登录用验签后的 user.id（不再用 email），与 middleware 的 key 对齐
        key = `user:${user.id}`
        email = user.email ?? null
      }
    } catch (error) {
      logInternalError('quota.auth', error)
    }
  }

  try {
    const [generate, chat] = await Promise.all([peekQuota(tier, 'generate', key), peekQuota(tier, 'chat', key)])

    return res.status(200).json({
      tier,
      email,
      unlimited: generate.unlimited,
      generate: { limit: generate.limit, remaining: generate.remaining },
      chat: { limit: chat.limit, remaining: chat.remaining },
      limits: QUOTA_LIMITS,
    })
  } catch (error) {
    logInternalError('quota', error)
    return res.status(500).json({ errorMessage: publicError() })
  }
}
