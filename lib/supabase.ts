import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '~/lib/supabase/client'

// 统一复用 client.ts 的配置判定，避免两处环境变量判断不一致
export { isSupabaseConfigured } from '~/lib/supabase/client'

/**
 * 浏览器端 Supabase 客户端（向后兼容入口）。
 *
 * 旧实现用裸 createClient + localStorage 存会话，服务端读 cookie 时永远拿不到，
 * 导致「登录后服务端恒为匿名」。现在直接返回 auth-helpers 的 cookie 客户端单例
 * （与 pages/_app.tsx 的 SessionContextProvider、lib/history.ts、Nav.tsx 共用同一实例），
 * 会话写入 cookie 后，服务端 createServerSupabaseClient 才能读取并验签。
 * 未配置环境变量时返回 null —— 账号体系整体降级为本地模式。
 */
export function getSupabase(): SupabaseClient | null {
  return getSupabaseBrowserClient()
}
