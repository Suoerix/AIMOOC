import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  History as HistoryIcon,
  Clock,
  Play,
  Trash2,
  Search,
  Filter,
  BookOpen,
  Trophy,
  Flame,
  ChevronRight,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Nav } from '~/components/Nav'
import {
  deleteCourse,
  listCourses,
  resumeHref,
  summarize,
  type CourseRecord,
} from '~/lib/history'
import { cn } from '~/lib/utils'

function fmtDuration(sec: number): string {
  if (!sec) return '0 分钟'
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${Math.max(1, m)} 分钟`
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hour = Math.floor(min / 60)
  if (hour < 24) return `${hour} 小时前`
  const day = Math.floor(hour / 24)
  if (day < 30) return `${day} 天前`
  return new Date(ts).toLocaleDateString('zh-CN')
}

export default function HistoryPage() {
  const [courses, setCourses] = useState<CourseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [subject, setSubject] = useState<string>('全部')

  useEffect(() => {
    let alive = true
    listCourses()
      .then((list) => {
        if (!alive) return
        setCourses(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const subjects = useMemo(() => {
    const set = new Set<string>()
    courses.forEach((c) => c.subject && set.add(c.subject))
    return ['全部', ...Array.from(set)]
  }, [courses])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return courses.filter((c) => {
      const matchSubject = subject === '全部' || c.subject === subject
      const matchKw =
        !kw ||
        c.title.toLowerCase().includes(kw) ||
        (c.subject || '').toLowerCase().includes(kw)
      return matchSubject && matchKw
    })
  }, [courses, keyword, subject])

  const stats = useMemo(() => summarize(courses), [courses])

  const remove = async (videoId: string, title: string) => {
    await deleteCourse(videoId)
    setCourses((prev) => prev.filter((c) => c.videoId !== videoId))
    toast.success(`已移除《${title}》的学习记录`)
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <Nav active="history" />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-[92px] sm:px-6">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            学习<span className="text-gradient-cyan-violet">历史</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            每上过的课都在这里 —— 继续学习、回看笔记、追踪你的学习轨迹
          </p>
        </motion.div>

        {/* 统计 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08 }}
          className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {[
            { icon: BookOpen, label: '学过的课', value: `${stats.totalCourses}`, accent: '#22d3ee' },
            { icon: Clock, label: '累计时长', value: fmtDuration(stats.totalSeconds), accent: '#a78bfa' },
            { icon: Trophy, label: '完成课程', value: `${stats.completedCourses}`, accent: '#34d399' },
            { icon: Flame, label: '连续学习', value: `${stats.streakDays} 天`, accent: '#fb923c' },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div
              key={label}
              className="glass rounded-2xl p-4 transition-colors hover:border-cyan-400/25"
            >
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                {label}
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
            </div>
          ))}
        </motion.div>

        {/* 工具栏 */}
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="glass flex h-11 flex-1 items-center gap-2 rounded-xl px-3">
            <Search className="h-4 w-4 text-slate-600" />
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索课程标题或学科…"
              className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            <Filter className="h-3.5 w-3.5 shrink-0 text-slate-600" />
            {subjects.map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={cn(
                  'shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors',
                  subject === s
                    ? 'bg-cyan-500/20 text-cyan-200'
                    : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08] hover:text-slate-200'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
            <HistoryIcon className="h-10 w-10 text-slate-700" />
            <div>
              <p className="text-sm font-medium text-slate-300">
                {courses.length === 0 ? '还没有学习记录' : '没有匹配的课程'}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                {courses.length === 0
                  ? '去首页粘贴一个 B 站视频链接，开启你的第一节 AI 课'
                  : '换个关键词或筛选条件试试'}
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105"
            >
              去挑一节课
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filtered.map((c, i) => (
              <motion.div
                key={c.videoId}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.3) }}
                className="glass group flex flex-col rounded-2xl p-5 transition-colors hover:border-cyan-400/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-[15px] font-semibold text-slate-100">
                      {c.title}
                    </h3>
                    <p className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                      {c.subject && (
                        <span className="rounded-md bg-violet-400/10 px-1.5 py-0.5 text-violet-300">
                          {c.subject}
                        </span>
                      )}
                      <span>{fmtRelative(c.lastAt)}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => remove(c.videoId, c.title)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-600 opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-300 group-hover:opacity-100"
                    title="删除记录"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* 进度 */}
                <div className="mt-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>学习进度</span>
                    <span className="font-mono text-cyan-300">{c.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(2, c.progress))}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtDuration(c.durationSec)}
                  </span>
                  {c.quizTotal > 0 && (
                    <span className="flex items-center gap-1">
                      <Trophy className="h-3 w-3" />
                      答题 {c.quizRight}/{c.quizTotal}
                    </span>
                  )}
                </div>

                <Link
                  href={resumeHref(c)}
                  className="mt-4 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-[13px] font-medium text-cyan-100 transition-all hover:from-cyan-500/45 hover:to-violet-500/45"
                >
                  <Play className="h-3.5 w-3.5" />
                  继续学习
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
