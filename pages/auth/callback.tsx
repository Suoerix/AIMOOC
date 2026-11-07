import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { useSupabaseClient } from '@supabase/auth-helpers-react'
import { isSupabaseConfigured } from '~/lib/supabase/client'

/** 有 Supabase 时读取会话（内部组件，保证 hook 调用条件稳定） */
function CallbackInner() {
  const router = useRouter()
  const supabaseClient = useSupabaseClient()

  useEffect(() => {
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      if (session) window.close()
    })
  }, [router, supabaseClient.auth])

  return null
}

export default function AuthCallback() {
  if (!isSupabaseConfigured()) return null
  return <CallbackInner />
}
