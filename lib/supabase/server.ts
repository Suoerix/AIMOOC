import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let serviceClient: SupabaseClient | null = null

/**
 * 服务端 Supabase 客户端（service role）。
 * service role 会绕过 RLS，只能在服务端使用（管理端聚合统计、埋点写入）。
 */
export function getServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!serviceClient) {
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serviceClient
}

/** 管理员邮箱白名单（逗号分隔） */
export function getAdminEmails(): string[] {
  return (process.env.SUPABASE_ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

/** 是否为管理员：白名单 或 user_profiles.role === 'admin' */
export async function isAdminUser(email?: string | null): Promise<boolean> {
  if (!email) return false
  const admins = getAdminEmails()
  if (admins.includes(email.toLowerCase())) return true

  const service = getServiceClient()
  if (!service) return false
  try {
    const { data } = await service
      .from('user_profiles')
      .select('role')
      .eq('email', email.toLowerCase())
      .limit(1)
    return data?.[0]?.role === 'admin'
  } catch {
    return false
  }
}
