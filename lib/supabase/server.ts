import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { logInternalError } from '~/lib/security/request'

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

/** 已验签的服务端用户最小形态（来自 createServerSupabaseClient().auth.getUser()） */
export interface AdminUserRef {
  id: string
  email?: string | null
}

/**
 * 是否为管理员。
 *
 * 身份必须来自服务端 getUser() 验签后的 user（带可信 id），不能只凭邮箱字符串：
 * cookie 里的 email 可被伪造，只有拿到验签后的 user.id 才允许参与判定。
 * 判定顺序：service role 按 id 查 user_profiles.role，命中 admin 即放行；
 * 否则当且仅当 user.id 存在时，才用 email 比对环境变量白名单兜底。
 *
 * 兼容旧的字符串（email）调用做防御：字符串没有可信 id，一律不视为管理员。
 */
export async function isAdminUser(user: AdminUserRef | string | null | undefined): Promise<boolean> {
  // 归一化：只接受带可信 id 的对象；旧的字符串调用无法提供 id，直接拒绝。
  let ref: AdminUserRef | null = null
  if (user && typeof user === 'object' && typeof user.id === 'string' && user.id) {
    ref = { id: user.id, email: user.email }
  }
  if (!ref) return false

  const service = getServiceClient()
  if (service) {
    try {
      const { data, error } = await service.from('user_profiles').select('role').eq('id', ref.id).limit(1)
      if (error) logInternalError('isAdminUser.profile', error)
      if (data?.[0]?.role === 'admin') return true
    } catch (error) {
      logInternalError('isAdminUser.profile', error)
    }
  }

  // 白名单兜底：必须 user.id 存在（ref 一定带 id）才允许按 email 比对
  const email = ref.email?.toLowerCase()
  return !!email && getAdminEmails().includes(email)
}
