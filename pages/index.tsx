import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { GraduationCap, BookOpen, Mic2, Eye, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Nav } from '~/components/Nav'
import { AuroraBackground } from '~/components/Home/AuroraBackground'
import { ChatEntry } from '~/components/Home/ChatEntry'
import { CaseGallery } from '~/components/Home/CaseGallery'
import { TEACHING_CASES } from '~/lib/cases'

const ROTATING_WORDS = ['可视化实验', '交互课件', 'AI 助教陪学', 'B 站视频精讲']

const HomePage: NextPage = () => {
  const router = useRouter()
  const [entered, setEntered] = useState(false)
  const [wordIndex, setWordIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)

  // 入场动画标记
  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 80)
    return () => clearTimeout(t)
  }, [])

  // 副标题打字机
  useEffect(() => {
    const word = ROTATING_WORDS[wordIndex % ROTATING_WORDS.length]
    const speed = deleting ? 40 : 90
    const timer = setTimeout(() => {
      if (!deleting) {
        setTyped(word.slice(0, typed.length + 1))
        if (typed.length + 1 === word.length) {
          setTimeout(() => setDeleting(true), 1600)
        }
      } else {
        setTyped(word.slice(0, typed.length - 1))
        if (typed.length - 1 === 0) {
          setDeleting(false)
          setWordIndex((i) => i + 1)
        }
      }
    }, speed)
    return () => clearTimeout(timer)
  }, [typed, deleting, wordIndex])

  const openCase = (caseId: string) => {
    router.push(`/demo/${caseId}`)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <AuroraBackground />
      <Nav active="home" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pb-16 pt-24 sm:px-8">
        {/* ============ HERO ============ */}
        <section className="flex flex-1 flex-col items-center justify-center py-10 text-center">
          {/* Logo 徽章 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -12 }}
            animate={entered ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="glass mb-7 flex items-center gap-2.5 rounded-full px-4 py-2"
          >
            <GraduationCap className="h-4 w-4 text-cyan-300" />
            <span className="text-xs tracking-widest text-slate-300">
              弘识智教 · AIMOOC
            </span>
          </motion.div>

          {/* 主标题 */}
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={entered ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.12, ease: [0.21, 1.02, 0.73, 1] }}
            className="max-w-3xl text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl"
          >
            把每一个视频
            <br />
            变成
            <span className="text-gradient-cyan-violet text-glow-cyan"> 一堂 AI 课</span>
          </motion.h1>

          {/* 副标题（打字机） */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={entered ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.24 }}
            className="mt-5 flex h-8 items-center justify-center text-base text-slate-400 sm:text-lg"
          >
            <span className="mr-1 inline-block h-5 w-5 animate-[spin_3s_linear_infinite] text-cyan-400">✦</span>
            由 AI 教室呈现
            <span className="ml-1.5 font-mono text-cyan-300">
              {typed}
              <span className="animate-caret ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-cyan-300" />
            </span>
          </motion.div>

          {/* 核心能力标签 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={entered ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.36 }}
            className="mb-9 mt-7 flex flex-wrap justify-center gap-2.5"
          >
            {[
              { icon: Eye, text: '可视化教学优先' },
              { icon: BookOpen, text: '视频一键成课件' },
              { icon: Mic2, text: 'AI 助教语音陪学' },
            ].map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-slate-300"
              >
                <Icon className="h-3.5 w-3.5 text-cyan-400" />
                {text}
              </div>
            ))}
          </motion.div>

          {/* Chatbot 核心入口 */}
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.98 }}
            animate={entered ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.48, ease: [0.21, 1.02, 0.73, 1] }}
            className="flex w-full justify-center"
          >
            <ChatEntry onOpenCase={openCase} />
          </motion.div>
        </section>

        {/* ============ 课程体系 CTA ============ */}
        <section className="py-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="glass-strong mx-auto flex max-w-3xl flex-col items-center gap-4 rounded-2xl p-6 text-center"
          >
            <BookOpen className="h-8 w-8 text-cyan-300" />
            <h3 className="text-xl font-semibold text-slate-100">把一整个合集，变成一门课</h3>
            <p className="max-w-xl text-sm text-slate-400">
              粘贴 B站合集 / YouTube 播放列表，或一串视频链接，自动生成带学习路径的课程。每一集都接入 AI 教室（总结 / 课件 / 出题 / 助教）。
            </p>
            <Link
              href="/courses"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/30 transition hover:scale-[1.02]"
            >
              开始构建课程
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </section>

        {/* ============ 案例广场 ============ */}
        <section id="cases" className="scroll-mt-24 py-14">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="mb-7 flex items-end justify-between"
          >
            <div>
              <h2 className="text-2xl font-semibold text-slate-100">
                内置可视化教学案例
              </h2>
              <p className="mt-1.5 text-sm text-slate-500">
                点击任意卡片，立即进入沉浸式互动实验 —— 它们也是 AI 教室课件形态的缩影
              </p>
            </div>
            <div className="hidden items-center gap-2 text-xs text-slate-600 sm:flex">
              <span className="h-px w-10 bg-gradient-to-r from-transparent to-slate-600" />
              PRESET GALLERY
              <span className="h-px w-10 bg-gradient-to-l from-transparent to-slate-600" />
            </div>
          </motion.div>

          <CaseGallery cases={TEACHING_CASES} onOpen={openCase} />
        </section>

        {/* ============ 页脚 ============ */}
        <footer className="mt-6 border-t border-white/[0.06] pt-8 text-center">
          <p className="text-xs text-slate-600">
            弘识智教 AIMOOC · AI 驱动的互动教学 · B 站视频 · 可视化实验 · 讯飞语音
          </p>
        </footer>
      </div>
    </div>
  )
}

export default HomePage
