import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, PlayCircle, CheckCircle2, Circle, GraduationCap, ListVideo } from 'lucide-react'
import Link from 'next/link'
import { Nav } from '~/components/Nav'
import { getCourse, episodeProgress, courseProgress } from '~/lib/course/store'
import { learningIdFromUrl } from '~/lib/history'
import type { Course } from '~/lib/course/types'

const CoursePage: NextPage = () => {
  const router = useRouter()
  const { id } = router.query
  const [course, setCourse] = useState<Course | null>(null)
  const [progressMap, setProgressMap] = useState<Record<number, number>>({})
  const [notFound, setNotFound] = useState(false)

  const refreshProgress = () => {
    if (!course) return
    const map: Record<number, number> = {}
    for (const ep of course.episodes) map[ep.order] = episodeProgress(ep.url)
    setProgressMap(map)
  }

  useEffect(() => {
    if (typeof id !== 'string') return
    const c = getCourse(id)
    if (!c) {
      setNotFound(true)
      return
    }
    setCourse(c)
  }, [id])

  useEffect(() => {
    refreshProgress()
    // 从教室返回后进度可能更新，监听焦点/可见性刷新
    const onFocus = () => refreshProgress()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshProgress()
    })
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course])

  if (notFound) {
    return (
      <div className="relative min-h-screen bg-[#040711] text-slate-100">
        <Nav active="courses" />
        <main className="relative z-10 mx-auto max-w-3xl px-5 pb-20 pt-32 text-center">
          <p className="text-lg text-slate-300">未找到该课程</p>
          <p className="mt-2 text-sm text-slate-500">课程可能来自其他设备，或已被删除。</p>
          <Link
            href="/courses"
            className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-cyan-500/20 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-500/30"
          >
            返回课程体系
          </Link>
        </main>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="relative min-h-screen bg-[#040711] text-slate-100">
        <Nav active="courses" />
        <main className="relative z-10 mx-auto max-w-3xl px-5 pt-32 text-center text-slate-400">加载中…</main>
      </div>
    )
  }

  const overall = courseProgress(course)
  const firstIncomplete = course.episodes.find((ep) => (progressMap[ep.order] ?? 0) < 100) ?? course.episodes[0]

  const episodeHref = (url: string) => `/learn/${learningIdFromUrl(url)}?url=${encodeURIComponent(url)}`

  return (
    <div className="relative min-h-screen bg-[#040711] text-slate-100">
      <Nav active="courses" />

      <main className="relative z-10 mx-auto max-w-4xl px-5 pb-20 pt-28 sm:px-8">
        <Link href="/courses" className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" />
          课程体系
        </Link>

        {/* 头部 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13px] text-slate-400">
                <GraduationCap className="h-4 w-4 text-cyan-300" />
                {course.sourceType === 'manual' ? '手动课程' : course.sourceType === 'bilibili' ? 'B站课程' : 'YouTube 课程'} ·{' '}
                {course.episodeCount} 集
              </p>
              <h1 className="mt-1 truncate text-2xl font-semibold text-slate-100">{course.title}</h1>
            </div>
            {firstIncomplete && (
              <Link
                href={episodeHref(firstIncomplete.url)}
                className="flex shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/30 transition hover:scale-[1.02]"
              >
                <PlayCircle className="h-4 w-4" />
                继续学习
              </Link>
            )}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${overall}%` }} />
            </div>
            <span className="text-sm text-slate-300">{overall}%</span>
          </div>
        </motion.div>

        {/* 章节列表 */}
        <h2 className="mb-3 mt-8 flex items-center gap-2 text-lg font-semibold text-slate-200">
          <ListVideo className="h-5 w-5 text-cyan-300" />
          学习路径
        </h2>
        <div className="space-y-2">
          {course.episodes.map((ep) => {
            const p = progressMap[ep.order] ?? 0
            const done = p >= 100
            const started = p > 0
            return (
              <Link
                key={ep.order}
                href={episodeHref(ep.url)}
                className="group flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
              >
                <span className="shrink-0">
                  {done ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  ) : started ? (
                    <PlayCircle className="h-5 w-5 text-cyan-300" />
                  ) : (
                    <Circle className="h-5 w-5 text-slate-600" />
                  )}
                </span>
                <span className="w-8 shrink-0 text-center text-sm text-slate-500">{ep.order}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{ep.title}</span>
                <span className="shrink-0 text-[12px] text-slate-500">{done ? '已完成' : started ? `${p}%` : '未开始'}</span>
                <ArrowLeft className="h-3.5 w-3.5 -rotate-180 text-slate-600 transition group-hover:text-cyan-200" />
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}

export default CoursePage
