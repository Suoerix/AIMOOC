import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 判断是否配置了 Supabase（登录为可选能力）。
 * 未配置时全站照常运行，只是没有账号体系 —— 这样 Vercel 预览环境、
 * 本地无 .env 的构建都不会因为缺少环境变量而失败。
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
}

let cached: SupabaseClient | null = null

/** 懒加载浏览器端 Supabase 客户端；未配置时返回 null */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null
  if (!cached) {
    // 动态 require：避免在未配置环境变量的构建期触发校验
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createBrowserSupabaseClient } = require('@supabase/auth-helpers-nextjs')
    cached = createBrowserSupabaseClient()
  }
  return cached
}
