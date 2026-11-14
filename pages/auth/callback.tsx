import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { getSupabaseBrowserClient, isSupabaseConfigured } from '~/lib/supabase/client'

/**
 * OAuth / 邮箱验证回调页。
 * Supabase 以 PKCE 流程重定向回来时会在 URL 带上 ?code=，
 * 用 exchangeCodeForSession(code) 换取会话；会话由统一 cookie 客户端写入，
 * 服务端 createServerSupabaseClient 才能读取并验签。
 */
export default function AuthCallback() {
  const router = useRouter()
  const configured = isSupabaseConfigured()
  const [error, setError] = useState<string | null>(null)
  // 保证 code 只交换一次，避免 React 严格模式 / 重复渲染导致 code 被重复使用
  const startedRef = useRef(false)

  useEffect(() => {
    if (!configured || !router.isReady || startedRef.current) return
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const code = router.query.code
    if (typeof code !== 'string' || !code) {
      setError('登录回调缺少授权码，请重新发起登录')
      return
    }

    startedRef.current = true
    let cancelled = false
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error: exchangeError }) => {
        if (cancelled) return
        if (exchangeError) {
          setError('登录验证失败，请返回首页后重新登录')
          return
        }
        router.replace('/')
      })
      .catch(() => {
        if (!cancelled) setError('登录验证失败，请返回首页后重新登录')
      })

    return () => {
      cancelled = true
    }
  }, [configured, router.isReady, router.query.code])

  // 未配置 Supabase：给出友好提示与返回首页链接，而不是白屏 / window.close()
  if (!configured) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#040711] px-6 text-center text-slate-100">
        <p className="text-sm text-slate-300">当前部署未接入 Supabase，无法完成第三方登录。</p>
        <Link href="/" className="text-sm text-cyan-300 underline-offset-4 hover:underline">
          返回首页
        </Link>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#040711] px-6 text-center text-slate-100">
      {error ? (
        <>
          <p className="text-sm text-rose-300">{error}</p>
          <Link href="/" className="text-sm text-cyan-300 underline-offset-4 hover:underline">
            返回首页
          </Link>
        </>
      ) : (
        <p className="text-sm text-slate-400">正在完成登录…</p>
      )}
    </div>
  )
}
