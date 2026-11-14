import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
// 统一使用 client.ts 的 cookie 客户端单例（与 SessionContextProvider 共用同一实例）；
// 保留 getSupabase 之名仅为兼容既有调用，实际指向 getSupabaseBrowserClient。
import { getSupabaseBrowserClient as getSupabase, isSupabaseConfigured } from '~/lib/supabase/client'

export interface AuthState {
  user: User | null
  loading: boolean
  /** 是否配置了 Supabase（未配置时账号体系整体降级） */
  configured: boolean
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: false,
  configured: false,
})

/**
 * 账号上下文。
 * 之所以自己实现而不直接用 auth-helpers 的 useUser：后者在没有
 * SessionContextProvider 时会直接抛错，会让「未配置 Supabase」的部署白屏。
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setUser(data.session?.user ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthState>(() => ({ user, loading, configured }), [user, loading, configured])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  return useContext(AuthContext)
}
