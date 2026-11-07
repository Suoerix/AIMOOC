import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { FREE_LIMIT_COUNT, LOGIN_LIMIT_COUNT } from '~/utils/constants'

/**
 * 懒加载限流器：仅在配置了 Upstash 环境变量时创建实例。
 * （此前模块顶层直接 new Redis，缺少 env 时任何 import 该模块的
 *   API 路由在冷启动即抛错 —— 已改为按需创建。）
 */

let ratelimitForIpsInstance: Ratelimit | null = null
let ratelimitForApiKeyIpsInstance: Ratelimit | null = null
let ratelimitForFreeAccountsInstance: Ratelimit | null = null

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_RATE_REDIS_REST_URL
  const token = process.env.UPSTASH_RATE_REDIS_REST_TOKEN
  if (!url || !token) return null
  return new Redis({ url, token })
}

function getRedisOrThrow(): Redis {
  const redis = getRedis()
  if (!redis) {
    throw new Error('Missing UPSTASH_RATE_REDIS_REST_URL / UPSTASH_RATE_REDIS_REST_TOKEN')
  }
  return redis
}

/** 未配置 Redis 时返回 null（调用方应直接放行） */
export function getRatelimitForIps(): Ratelimit | null {
  if (!getRedis()) return null
  if (!ratelimitForIpsInstance) {
    ratelimitForIpsInstance = new Ratelimit({
      redis: getRedisOrThrow(),
      limiter: Ratelimit.fixedWindow(FREE_LIMIT_COUNT, '1 d'),
      analytics: true,
    })
  }
  return ratelimitForIpsInstance
}

export function getRatelimitForApiKeyIps(): Ratelimit | null {
  if (!getRedis()) return null
  if (!ratelimitForApiKeyIpsInstance) {
    ratelimitForApiKeyIpsInstance = new Ratelimit({
      redis: getRedisOrThrow(),
      limiter: Ratelimit.fixedWindow(FREE_LIMIT_COUNT * 2, '1 d'),
      analytics: true,
    })
  }
  return ratelimitForApiKeyIpsInstance
}

export function getRatelimitForFreeAccounts(): Ratelimit | null {
  if (!getRedis()) return null
  if (!ratelimitForFreeAccountsInstance) {
    ratelimitForFreeAccountsInstance = new Ratelimit({
      redis: getRedisOrThrow(),
      limiter: Ratelimit.fixedWindow(LOGIN_LIMIT_COUNT, '1 d'),
      analytics: true,
    })
  }
  return ratelimitForFreeAccountsInstance
}
