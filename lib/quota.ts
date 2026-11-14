import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from './logger'

/** Upstash 限流窗口的合法取值类型 */
type RatelimitDuration = Parameters<typeof Ratelimit.fixedWindow>[1]

/**
 * 反滥用配额。
 *
 * 修复点（相对旧实现）：
 * 1. 环境变量名统一：旧 middleware 用 UPSTASH_REDIS_REST_*，这里用
 *    UPSTASH_RATE_REDIS_REST_*，导致「配了 Redis 但限流仍不生效」。两者都兼容。
 * 2. Redis 与 limiter 全部单例，不再每次请求 new Redis。
 * 3. 未配置 Redis 时不再完全裸奔：启用进程内固定窗口兜底限流
 *    （单实例有效，多实例部署仍需配置 Upstash）。
 * 4. 新增 consumeRate，用于给写库 / 代理 / 登录类接口做轻量 IP 频率限制。
 */

export type QuotaTier = 'anon' | 'user'
export type QuotaAction = 'generate' | 'chat'

/** 每日额度（次/天） */
export const QUOTA_LIMITS: Record<QuotaTier, Record<QuotaAction, number>> = {
  anon: { generate: 5, chat: 50 },
  user: { generate: 30, chat: 500 },
}

export const QUOTA_WINDOW = '1 d' as const
export const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000

let redisInstance: Redis | null | undefined
const limiters = new Map<string, Ratelimit>()
const memoryCounters = new Map<string, { count: number; resetAt: number }>()

/** 统一读取两套历史变量名，避免配置漂移 */
function redisConfig(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_RATE_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_RATE_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance
  const config = redisConfig()
  redisInstance = config ? new Redis(config) : null
  return redisInstance
}

export function isQuotaConfigured(): boolean {
  return !!getRedis()
}

function getLimiter(cacheKey: string, limit: number, window: RatelimitDuration): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  let limiter = limiters.get(cacheKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(limit, window),
      analytics: true,
      prefix: 'aimooc_quota',
    })
    limiters.set(cacheKey, limiter)
  }
  return limiter
}

/** 进程内兜底计数器；带惰性过期清理，避免长期运行内存膨胀 */
function memoryConsume(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; reset: number } {
  const now = Date.now()
  if (memoryCounters.size > 5000) {
    memoryCounters.forEach((v, k) => {
      if (v.resetAt <= now) memoryCounters.delete(k)
    })
  }
  let entry = memoryCounters.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    memoryCounters.set(key, entry)
  }
  entry.count += 1
  return {
    allowed: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.resetAt,
  }
}

function memoryPeek(key: string, limit: number): { allowed: boolean; remaining: number; reset: number } {
  const entry = memoryCounters.get(key)
  if (!entry || entry.resetAt <= Date.now()) return { allowed: true, remaining: limit, reset: Date.now() }
  return { allowed: entry.count < limit, remaining: Math.max(0, limit - entry.count), reset: entry.resetAt }
}

export interface QuotaResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
  /** true 表示既没配 Upstash、也没启用兜底（保留字段以兼容前端） */
  unlimited: boolean
  /** 'upstash' | 'memory'，便于诊断当前限流由谁承担 */
  backend: 'upstash' | 'memory'
}

export async function consumeQuota(tier: QuotaTier, action: QuotaAction, key: string): Promise<QuotaResult> {
  const limit = QUOTA_LIMITS[tier][action]
  const cacheKey = `${tier}:${action}`
  const limiter = getLimiter(cacheKey, limit, QUOTA_WINDOW)
  if (limiter) {
    try {
      const res = await limiter.limit(key)
      return {
        allowed: res.success,
        limit: res.limit,
        remaining: Math.max(0, res.remaining),
        reset: res.reset,
        unlimited: false,
        backend: 'upstash',
      }
    } catch (error) {
      // Redis 故障时降级到内存限流，而不是直接放行
      logger.error('quota', '[quota] Upstash 不可用，降级到进程内限流', error)
    }
  }
  const res = memoryConsume(`${cacheKey}:${key}`, limit, QUOTA_WINDOW_MS)
  return { ...res, limit, unlimited: false, backend: 'memory' }
}

export async function peekQuota(tier: QuotaTier, action: QuotaAction, key: string): Promise<QuotaResult> {
  const limit = QUOTA_LIMITS[tier][action]
  const cacheKey = `${tier}:${action}`
  const limiter = getLimiter(cacheKey, limit, QUOTA_WINDOW)
  if (limiter) {
    try {
      const res = await limiter.getRemaining(key)
      const remaining = Array.isArray(res) ? res[0] : res
      return {
        allowed: remaining > 0,
        limit,
        remaining: Math.max(0, remaining),
        reset: Date.now(),
        unlimited: false,
        backend: 'upstash',
      }
    } catch (error) {
      logger.error('quota', '[quota] peek 降级', error)
    }
  }
  return { ...memoryPeek(`${cacheKey}:${key}`, limit), limit, unlimited: false, backend: 'memory' }
}

/** 轻量 IP 频率限制：给不消耗生成额度、但会打上游/写库的接口兜底 */
export async function consumeRate(
  key: string,
  limit: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const window: RatelimitDuration = `${windowSec} s`
  const limiter = getLimiter(`rate:${limit}:${window}`, limit, window)
  if (limiter) {
    try {
      const res = await limiter.limit(key)
      return { allowed: res.success, remaining: Math.max(0, res.remaining), reset: res.reset }
    } catch (error) {
      logger.error('quota', '[quota] rate 降级', error)
    }
  }
  return memoryConsume(`rate:${limit}:${window}:${key}`, limit, windowSec * 1000)
}

export function quotaMessage(tier: QuotaTier, action: QuotaAction, limit: number): string {
  if (tier === 'anon') {
    return `今日免费额度已用完（${limit} 次/天）。登录账号即可获得更高额度，并同步你的学习历史。`
  }
  return `今日额度已用完（${limit} 次/天），明天 0 点自动重置。`
}
