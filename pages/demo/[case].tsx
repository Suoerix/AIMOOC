import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Wand2 } from 'lucide-react'
import { getCase } from '~/lib/cases'

const DemoPage: NextPage = () => {
  const router = useRouter()
  const { case: caseId } = router.query
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120)
    return () => clearTimeout(t)
  }, [])

  const c = typeof caseId === 'string' ? getCase(caseId) : undefined

  if (!c) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#040711] text-slate-300">
        <div className="text-center">
          <p className="text-lg">案例不存在</p>
          <Link href="/" className="mt-3 inline-block text-sm text-cyan-400 hover:underline">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#040711] text-slate-100">
      {/* 顶栏 */}
      <motion.header
        initial={{ opacity: 0, y: -16 }}
        animate={ready ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="glass-strong sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6"
      >
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-300 transition-colors hover:bg-slate-100/10 hover:text-white"
          aria-label="返回首页"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="text-xl leading-none">{c.icon}</span>
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-semibold">{c.title}</h1>
            <p className="truncate text-[11px] text-slate-500">{c.subject}</p>
          </div>
        </div>
        <div
          className="hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:flex"
          style={{ background: `${c.accent}1a`, color: c.accent, border: `1px solid ${c.accent}33` }}
        >
          <Wand2 className="h-3 w-3" />
          互动实验中
        </div>
        <Link
          href={`/demo/${c.id}?raw=1`}
          target="_blank"
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-400 transition-colors hover:bg-slate-100/10 hover:text-white"
          aria-label="新窗口打开"
        >
          <ExternalLink className="h-4 w-4" />
        </Link>
      </motion.header>

      {/* 实验舞台 */}
      <motion.main
        initial={{ opacity: 0, scale: 0.985, y: 16 }}
        animate={ready ? { opacity: 1, scale: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.08, ease: [0.21, 1.02, 0.73, 1] }}
        className="flex flex-1 items-center justify-center p-3 sm:p-5"
      >
        <div
          className="relative w-full max-w-5xl overflow-hidden rounded-2xl"
          style={{
            border: `1px solid ${c.accent}33`,
            boxShadow: `0 0 60px ${c.accent}18, 0 20px 60px rgba(0,0,0,.5)`,
          }}
        >
          <iframe
            srcDoc={c.html}
            sandbox="allow-scripts allow-forms allow-popups"
            title={c.title}
            className="block h-[calc(100vh-140px)] min-h-[480px] w-full border-0 bg-[#050914]"
          />
        </div>
      </motion.main>
    </div>
  )
}

export default DemoPage
