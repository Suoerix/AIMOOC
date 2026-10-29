import { createMiddlewareSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { Redis } from '@upstash/redis'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SummarizeParams } from '~/lib/types'
import { getCacheId } from '~/utils/getCacheId'
import { ratelimitForFreeAccounts, ratelimitForIps } from '~/lib/upstash'
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
  return NextResponse.redirect(new URL('/shop', req.url))
}

export async function middleware(req: NextRequest, context: NextFetchEvent) {
  try {
    const { videoConfig } = (await req.json()) as SummarizeParams
    const cacheId = getCacheId(videoConfig)
    const ipIdentifier = req.ip ?? '127.0.0.11'

    if (isDev) {
      return NextResponse.next()
    }

    const { success, remaining } = await ratelimitForIps.limit(ipIdentifier)
    console.log(`ip free user ${ipIdentifier}, remaining: ${remaining}`)
    if (!success) {
      const res = NextResponse.next()
      const supabase = createMiddlewareSupabaseClient({ req, res })
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userEmail = session?.user.email
      if (userEmail) {
        const { success, remaining } = await ratelimitForFreeAccounts.limit(userEmail)
        console.log(`login user ${userEmail}, remaining: ${remaining}`)
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
  } catch (e) {
    console.error(e)
    return NextResponse.next()
  }
}

export const config = {
  matcher: '/api/sumup',
}
