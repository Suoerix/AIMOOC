import { Inter as FontSans } from 'next/font/google'
import type { Session } from '@supabase/auth-helpers-nextjs'
import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { ThemeProvider } from 'next-themes'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { Toaster } from '~/components/ui/toaster'
import { TooltipProvider } from '~/components/ui/tooltip'
import { getSupabaseBrowserClient } from '~/lib/supabase/client'
import { AuthProvider } from '~/lib/supabase/auth-context'
import '~/styles/globals.css'
import '~/styles/markdown.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

function MyApp({
  Component,
  pageProps,
}: AppProps<{
  initialSession: Session
}>) {
  // 统一使用 client.ts 的 cookie 客户端单例：SessionContextProvider 与 AuthProvider
  // 共享同一实例，登录态写入 cookie 后服务端 createServerSupabaseClient 才能读取并验签。
  // 未配置 Supabase 时为 null，此时跳过 SessionContextProvider
  const [supabaseClient] = useState(() => getSupabaseBrowserClient())

  const shell = (
    <ThemeProvider attribute="class" forcedTheme="dark" enableSystem={false}>
      <TooltipProvider>
        <AuthProvider>
          <div className={`min-h-screen bg-[#040711] font-sans text-slate-100 antialiased ${fontSans.variable}`}>
            <Component {...pageProps} />
          </div>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  )

  if (!supabaseClient) return shell

  return (
    <SessionContextProvider supabaseClient={supabaseClient} initialSession={pageProps.initialSession}>
      {shell}
    </SessionContextProvider>
  )
}

export default MyApp
