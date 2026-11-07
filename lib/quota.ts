import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * 反滥用配额。
 * 匿名用户与已登录用户分级：登录用户额度更高（登录本身即是防滥用的第一道闸），
 * 未登录用户按 IP 计数，登录用户按邮箱计数。
 *
 * 需要配置 Upstash（UPSTASH_RATE_REDIS_REST_URL / TOKEN）。
 * 未配置时返回 null —— 此时不做硬限制，但会在响应里带上限流说明头，
 * 由前端提示「当前部署未开启配额限制」。
 */

export type QuotaTier = 'anon' | 'user'
export type QuotaAction = 'generate' | 'chat'

/** 每日额度（次/天） */
export const QUOTA_LIMITS: Record<QuotaTier, Record<QuotaAction, number>> = {
  anon: { generate: 5, chat: 50 },
  user: { generate: 30, chat: 500 },
}

export const QUOTA_WINDOW = '1 d'

let redisInstance: Redis | null = null
const limiters = new Map<string, Ratelimit>()

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_RATE_REDIS_REST_URL
  const token = process.env.UPSTASH_RATE_REDIS_REST_TOKEN
  if (!url || !token) return null
  if (!redisInstance) redisInstance = new Redis({ url, token })
  return redisInstance
}

function getLimiter(tier: QuotaTier, action: QuotaAction): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  const cacheKey = `${tier}:${action}`
  let limiter = limiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(QUOTA_LIMITS[tier][action], QUOTA_WINDOW),
      analytics: true,
      prefix: 'aimooc_quota',
    })
    limiters.set(cacheKey, limiter)
  }
  return limiter
}

export interface QuotaResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
  /** 未配置 Redis 时为 true：表示没有硬限制 */
  unlimited: boolean
}

/**
 * 消耗一次配额。
 * @param tier  'anon' 未登录 / 'user' 已登录
 * @param action 'generate' 课件/可视化/出题等重生成 / 'chat' 轻量对话
 * @param key    计数标识（IP 或用户邮箱）
 */
export async function consumeQuota(
  tier: QuotaTier,
  action: QuotaAction,
  key: string
): Promise<QuotaResult> {
  const limit = QUOTA_LIMITS[tier][action]
  const limiter = getLimiter(tier, action)
  if (!limiter) {
    return { allowed: true, limit, remaining: limit, reset: Date.now(), unlimited: true }
  }
  const res = await limiter.limit(key)
  return {
    allowed: res.success,
    limit: res.limit,
    remaining: Math.max(0, res.remaining),
    reset: res.reset,
    unlimited: false,
  }
}

/** 只查询不消耗（用于展示「今日剩余额度」） */
export async function peekQuota(
  tier: QuotaTier,
  action: QuotaAction,
  key: string
): Promise<QuotaResult> {
  const limit = QUOTA_LIMITS[tier][action]
  const limiter = getLimiter(tier, action)
  if (!limiter) {
    return { allowed: true, limit, remaining: limit, reset: Date.now(), unlimited: true }
  }
  try {
    const res = await limiter.getRemaining(key)
    const remaining = Array.isArray(res) ? res[0] : res
    return {
      allowed: remaining > 0,
      limit,
      remaining: Math.max(0, remaining),
      reset: Date.now(),
      unlimited: false,
    }
  } catch {
    return { allowed: true, limit, remaining: limit, reset: Date.now(), unlimited: true }
  }
}

/** 配额超限的提示文案 */
export function quotaMessage(tier: QuotaTier, action: QuotaAction, limit: number): string {
  if (tier === 'anon') {
    return `今日免费额度已用完（${limit} 次/天）。登录账号即可获得更高额度，并同步你的学习历史。`
  }
  return `今日额度已用完（${limit} 次/天），明天 0 点自动重置。`
}
