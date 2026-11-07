import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { Redis } from '@upstash/redis'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SummarizeParams } from '~/lib/types'
import { getCacheId } from '~/utils/getCacheId'
import { getRatelimitForFreeAccounts, getRatelimitForIps } from '~/lib/upstash'
import { consumeQuota, quotaMessage, type QuotaAction, type QuotaTier } from '~/lib/quota'
import { isDev } from '~/utils/env'

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null

function redirectAuth(): NextResponse {
  console.error('Authentication Failed')
  return new NextResponse(JSON.stringify({ success: false, message: 'Authentication Failed' }), {
    status: 401,
    headers: { 'content-type': 'application/json' },
  })
}

function redirectShop(req: NextRequest): NextResponse {
  console.error('Account Limited')
  return NextResponse.redirect(new URL('/', req.url))
}

/** 识别调用方身份：已登录用邮箱（用户级配额），未登录用 IP（匿名配额） */
async function resolveIdentity(req: NextRequest): Promise<{ tier: QuotaTier; key: string }> {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const ip = req.ip || forwarded.split(',')[0]?.trim() || '127.0.0.1'

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    try {
      const res = NextResponse.next()
      const supabase = createMiddlewareSupabaseClient({ req, res })
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const email = session?.user?.email
      if (email) return { tier: 'user', key: email.toLowerCase() }
    } catch {
      /* 取不到会话就按匿名处理 */
    }
  }
  return { tier: 'anon', key: `ip:${ip}` }
}

/** 旧版 summary 接口：保留缓存 + 限流逻辑 */
async function handleSumup(req: NextRequest): Promise<NextResponse> {
  const { videoConfig } = (await req.json()) as SummarizeParams
  const cacheId = getCacheId(videoConfig)
  const ipIdentifier = req.ip ?? '127.0.0.11'

  if (isDev) {
    return NextResponse.next()
  }

  const ratelimitForIps = getRatelimitForIps()
  if (!ratelimitForIps) {
    // 未配置限流 Redis：直接放行（缓存仍可用）
    return NextResponse.next()
  }

  const { success, remaining } = await ratelimitForIps.limit(ipIdentifier)
  console.log(`ip free user ${ipIdentifier}, remaining: ${remaining}`)
  if (!success) {
    const res = NextResponse.next()
    // 未配置 Supabase：没有账号体系可回退，直接要求登录/限流
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return redirectAuth()
    }
    const supabase = createMiddlewareSupabaseClient({ req, res })
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const userEmail = session?.user.email
    if (userEmail) {
      const ratelimitForFreeAccounts = getRatelimitForFreeAccounts()
      if (!ratelimitForFreeAccounts) return res
      const { success } = await ratelimitForFreeAccounts.limit(userEmail)
      if (!success) {
        return redirectShop(req)
      }
      return res
    }

    return redirectAuth()
  }

  if (redis) {
    const result = await redis.get<string>(cacheId)
    if (result) {
      console.log('hit cache for ', cacheId)
      return new NextResponse(result, {
        status: 200,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      })
    }
  }

  return NextResponse.next()
}

/** 生成类 / 对话类接口：按身份分级限额，防止刷接口 */
async function handleQuota(req: NextRequest, pathname: string): Promise<NextResponse> {
  const action: QuotaAction = pathname === '/api/chat' ? 'chat' : 'generate'
  const { tier, key } = await resolveIdentity(req)
  const result = await consumeQuota(tier, action, key)

  if (!result.allowed) {
    console.warn(`[quota] ${tier}/${action} 触发限额: ${key}`)
    return NextResponse.json(
      {
        errorMessage: quotaMessage(tier, action, result.limit),
        quota: { tier, action, limit: result.limit, remaining: 0, reset: result.reset },
      },
      { status: 429 }
    )
  }

  const res = NextResponse.next()
  res.headers.set('X-Quota-Tier', tier)
  res.headers.set('X-Quota-Remaining', String(result.remaining))
  res.headers.set('X-Quota-Limit', String(result.limit))
  return res
}

export async function middleware(req: NextRequest, context: NextFetchEvent) {
  try {
    const { pathname } = req.nextUrl
    if (pathname === '/api/sumup') return await handleSumup(req)
    return await handleQuota(req, pathname)
  } catch (e) {
    console.error(e)
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/api/sumup', '/api/courseware', '/api/visualize', '/api/quiz', '/api/chat'],
}
