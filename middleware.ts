import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { consumeQuota, consumeRate, quotaMessage, type QuotaAction, type QuotaTier } from '~/lib/quota'
import { clientIpKey, logInternalError, publicError } from '~/lib/security/request'

/**
 * 全 API 防护层。
 *
 * 修复点（相对旧实现）：
 * 1. matcher 从 5 个路由扩展到全部 /api/*：/api/tts、/api/track、
 *    /api/bilibili/*、/api/b23tv、/api/admin/stats 不再裸奔。
 * 2. 不再读取 req.json()：旧 handleSumup 在中间件里消费请求体，
 *    既造成畸形 JSON 绕过限流，也让下游接口读 body 存在兼容风险。
 * 3. 失败即关闭：涉及大模型花费的接口出错返回 503，不再无条件 next()。
 * 4. 身份用 getUser() 验签；匿名计数用不可伪造的 clientIpKey。
 * 5. 未配置 Upstash 时由 lib/quota 的进程内限流兜底，不再 unlimited 放行。
 */

/** 会消耗模型 token / 第三方额度的接口，按身份分级限额 */
const EXPENSIVE_ROUTES: Record<string, QuotaAction> = {
  '/api/chat': 'chat',
  '/api/courseware': 'generate',
  '/api/visualize': 'generate',
  '/api/quiz': 'generate',
  '/api/sumup': 'generate',
  '/api/tts': 'generate',
  '/api/bilibili/notes': 'generate',
}

/** 其余接口统一做轻量 IP 频率限制（打上游、写库、登录、诊断等） */
const RATE_LIMIT = 90
const RATE_WINDOW_SEC = 60

function jsonError(status: number, errorMessage: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ errorMessage, ...extra }, { status })
}

function supabaseConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/** 已登录按 user.id 计数，匿名按不可伪造的 IP 摘要计数 */
async function resolveIdentity(req: NextRequest, res: NextResponse): Promise<{ tier: QuotaTier; key: string }> {
  const ipKey = clientIpKey(req)
  if (!supabaseConfigured()) return { tier: 'anon', key: ipKey }
  try {
    const supabase = createMiddlewareSupabaseClient({ req, res })
    const { data } = await supabase.auth.getUser()
    if (data?.user?.id) return { tier: 'user', key: `user:${data.user.id}` }
  } catch (error) {
    // 认证服务不可达时降级为匿名，但不能因此跳过限流
    logInternalError('middleware.auth', error)
  }
  return { tier: 'anon', key: ipKey }
}

export async function middleware(req: NextRequest, _context: NextFetchEvent): Promise<NextResponse> {
  const { pathname } = req.nextUrl
  const action = EXPENSIVE_ROUTES[pathname]

  // 仅开发环境可显式关闭，生产环境永远生效
  const bypass = process.env.NODE_ENV !== 'production' && process.env.AIMOOC_DISABLE_QUOTA === '1'
  if (bypass) return NextResponse.next()

  try {
    const res = NextResponse.next()

    if (action) {
      const { tier, key } = await resolveIdentity(req, res)
      const result = await consumeQuota(tier, action, key)
      if (!result.allowed) {
        return jsonError(429, quotaMessage(tier, action, result.limit), {
          quota: { tier, action, limit: result.limit, remaining: 0, reset: result.reset },
        })
      }
      res.headers.set('X-Quota-Tier', tier)
      res.headers.set('X-Quota-Remaining', String(result.remaining))
      res.headers.set('X-Quota-Limit', String(result.limit))
      res.headers.set('X-Quota-Backend', result.backend)
      return res
    }

    const rateKey = `rate:${clientIpKey(req)}:${pathname}`
    const rate = await consumeRate(rateKey, RATE_LIMIT, RATE_WINDOW_SEC)
    if (!rate.allowed) return jsonError(429, '请求过于频繁，请稍后再试')
    res.headers.set('X-RateLimit-Remaining', String(rate.remaining))
    return res
  } catch (error) {
    logInternalError('middleware', error)
    // 昂贵接口失败即关闭；其余只读/低风险接口降级放行
    if (action) return jsonError(503, publicError())
    return NextResponse.next()
  }
}

export const config = {
  matcher: ['/api/:path*'],
}
