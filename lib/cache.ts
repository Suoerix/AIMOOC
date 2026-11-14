import { Redis } from '@upstash/redis'
import { LIMITS } from '~/lib/security/input'

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    }
  } catch (e) {
    console.error('Failed to init redis cache:', e)
  }
  return redis
}

export async function getCache<T>(key: string): Promise<T | null> {
  const client = getRedis()
  if (!client) return null
  try {
    const value = await client.get<T>(key)
    if (value == null) return null
    // 读取异常 / 异常放大：超长缓存值一律当作未命中，避免把污染内容灌回客户端
    if (typeof value === 'string' && value.length > LIMITS.cacheValueChars) return null
    return value
  } catch (e) {
    console.error('Cache read error:', e)
    // 读取失败不影响主流程，优雅降级为未命中
    return null
  }
}

export async function setCache(key: string, value: string, ttlSeconds = 7 * 24 * 60 * 60): Promise<void> {
  const client = getRedis()
  if (!client) return
  // 写入值大小上限：超限静默跳过，避免 AI 输出把 Redis / 费用打爆
  if (typeof value !== 'string' || value.length > LIMITS.cacheValueChars) return
  try {
    await client.set(key, value, { ex: ttlSeconds })
  } catch (e) {
    console.error('Cache write error:', e)
  }
}
