import { Redis } from '@upstash/redis'

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
    return (await client.get<T>(key)) ?? null
  } catch (e) {
    console.error('Cache read error:', e)
    return null
  }
}

export async function setCache(key: string, value: string, ttlSeconds = 7 * 24 * 60 * 60): Promise<void> {
  const client = getRedis()
  if (!client) return
  try {
    await redis?.set(key, value, { ex: ttlSeconds })
  } catch (e) {
    console.error('Cache write error:', e)
  }
}
