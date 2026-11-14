import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { FREE_LIMIT_COUNT, LOGIN_LIMIT_COUNT } from '~/utils/constants'

/**
 * 旧版 summary 接口保留的限流器。
 * 修复：Redis 客户端改为单例（旧实现每次调用 getRedis() 都 new Redis，
 * 且 getRatelimitForIps() 内部会调用两次，冷启动与 GC 开销明显）。
 */

let redisInstance: Redis | null | undefined
let ratelimitForIpsInstance: Ratelimit | null = null
let ratelimitForApiKeyIpsInstance: Ratelimit | null = null
let ratelimitForFreeAccountsInstance: Ratelimit | null = null

function getRedis(): Redis | null {
  if (redisInstance !== undefined) return redisInstance
  const url = process.env.UPSTASH_RATE_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_RATE_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  redisInstance = url && token ? new Redis({ url, token }) : null
  return redisInstance
}

function build(limit: number): Ratelimit | null {
  const redis = getRedis()
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(limit, '1 d'),
    analytics: true,
  })
}

export function getRatelimitForIps(): Ratelimit | null {
  if (!ratelimitForIpsInstance) ratelimitForIpsInstance = build(FREE_LIMIT_COUNT)
  return ratelimitForIpsInstance
}

export function getRatelimitForApiKeyIps(): Ratelimit | null {
  if (!ratelimitForApiKeyIpsInstance) ratelimitForApiKeyIpsInstance = build(FREE_LIMIT_COUNT * 2)
  return ratelimitForApiKeyIpsInstance
}

export function getRatelimitForFreeAccounts(): Ratelimit | null {
  if (!ratelimitForFreeAccountsInstance) ratelimitForFreeAccountsInstance = build(LOGIN_LIMIT_COUNT)
  return ratelimitForFreeAccountsInstance
}
