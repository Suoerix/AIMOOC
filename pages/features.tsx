import type { NextPage } from 'next'
import Head from 'next/head'
import { motion } from 'framer-motion'
import { LayoutGrid } from 'lucide-react'
import { Nav } from '~/components/Nav'
import { FeatureCatalog } from '~/components/FeatureCatalog'

// 偏静态页：ISR 缓存 1 小时，降低重复渲染开销
export const revalidate = 3600

const HERO_TAGS = ['交互实验', '主页面', 'AI 教室', '隐藏能力', '视频来源', '配置状态']

const FeaturesPage: NextPage = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <Head>
        <title>功能全览 · 弘识智教 AIMOOC</title>
        <meta
          name="description"
          content="一页看清 AIMOOC 的全部能力：交互实验、主页面、AI 教室、隐藏能力、视频来源与配置状态。"
        />
      </Head>

      <Nav active="features" />

      {/* 网格底纹 */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_0%,#000_10%,transparent_72%)]"
      />
      {/* 顶部极光 */}
      <div
        aria-hidden
        className="animate-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.13),transparent_62%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[12%] h-[320px] w-[420px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.11),transparent_65%)] blur-2xl"
      />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-[72px] sm:px-8">
        {/* ============ HERO ============ */}
        <section className="flex flex-col items-center py-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="glass relative mb-7 overflow-hidden rounded-full px-4 py-2"
          >
            <div
              aria-hidden
              className="animate-beam pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent"
            />
            <span className="relative flex items-center gap-2.5 text-xs tracking-widest text-slate-300">
              <LayoutGrid className="h-4 w-4 text-cyan-300" />
              弘识智教 · AIMOOC
              <span className="h-3 w-px bg-white/15" />
              <span className="font-mono text-cyan-300/80">FEATURES</span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.21, 1.02, 0.73, 1] }}
            className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl"
          >
            <span className="text-gradient-cyan-violet text-glow-cyan">功能全览</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-5 max-w-2xl text-base text-slate-400 sm:text-lg"
          >
            一页看清项目的全部能力：从交互实验、AI 教室到视频来源与运行环境。
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-2"
          >
            {HERO_TAGS.map((v) => (
              <span
                key={v}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-slate-400 transition-colors duration-300 hover:border-cyan-400/30 hover:text-cyan-300"
              >
                {v}
              </span>
            ))}
          </motion.div>
        </section>

        {/* ============ 功能目录 ============ */}
        <FeatureCatalog />

        {/* ============ 页脚 ============ */}
        <footer className="mt-6 border-t border-white/[0.06] pt-8 text-center">
          <p className="text-xs text-slate-600">弘识智教 AIMOOC · 功能全览 · Next.js 14 + TypeScript + Tailwind CSS</p>
        </footer>
      </main>
    </div>
  )
}

export default FeaturesPage
