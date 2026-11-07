import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Gauge, Clock, Trophy, Flame, BookOpen, ChevronRight } from 'lucide-react'
import { Nav } from '~/components/Nav'
import { AreaTrend, DonutChart } from '~/components/admin/Charts'
import { listCourses, summarize, type CourseRecord } from '~/lib/history'

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.round((sec % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分钟`
}

export default function ProgressPage() {
  const [courses, setCourses] = useState<CourseRecord[]>([])
  const [loading, setLoading] = useState(true)

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

  const stats = useMemo(() => summarize(courses), [courses])

  const dailyMinutes = useMemo(
    () => stats.dailySeconds.map((d) => ({ label: d.label, value: Math.round(d.value / 60) })),
    [stats.dailySeconds]
  )

  const subjectData = useMemo(
    () =>
      stats.bySubject.slice(0, 6).map((s) => ({
        label: s.label,
        value: Math.round(s.value / 60),
        color: ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#f87171'][
          stats.bySubject.indexOf(s) % 6
        ],
      })),
    [stats.bySubject]
  )

  const maxMinutes = Math.max(60, ...dailyMinutes.map((d) => d.value))
  const activeDays = dailyMinutes.filter((d) => d.value > 0).length

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <Nav active="progress" />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-[92px] sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            学习<span className="text-gradient-cyan-violet">进度</span>
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            你在 AI 教室里投入的时间与精力，都被记录成了轨迹
          </p>
        </motion.div>

        {/* 指标卡 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.06 }}
          className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          {[
            { icon: Clock, label: '累计学习时长', value: fmtDuration(stats.totalSeconds), accent: '#22d3ee' },
            { icon: BookOpen, label: '在学课程', value: `${stats.totalCourses} 门`, accent: '#a78bfa' },
            { icon: Trophy, label: '已完成', value: `${stats.completedCourses} 门`, accent: '#34d399' },
            { icon: Flame, label: '连续学习', value: `${stats.streakDays} 天`, accent: '#fb923c' },
          ].map(({ icon: Icon, label, value, accent }) => (
            <div key={label} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-[11px] text-slate-500">
                <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
                {label}
              </div>
              <p className="mt-2 text-xl font-semibold text-slate-100">{value}</p>
            </div>
          ))}
        </motion.div>

        {loading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            <div className="glass h-72 animate-pulse rounded-2xl lg:col-span-3" />
            <div className="glass h-72 animate-pulse rounded-2xl lg:col-span-2" />
          </div>
        ) : courses.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
            <Gauge className="h-10 w-10 text-slate-700" />
            <div>
              <p className="text-sm font-medium text-slate-300">还没有学习数据</p>
              <p className="mt-1.5 text-xs text-slate-600">
                上完一节课后，这里会出现你的时长、进度与学科分布
              </p>
            </div>
            <Link
              href="/"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105"
            >
              开始第一节课
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-5">
            {/* 趋势 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass rounded-2xl p-5 lg:col-span-3"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-[15px] font-semibold text-slate-100">最近 14 天学习时长</h2>
                  <p className="mt-1 text-[11px] text-slate-500">
                    共 {activeDays} 天有学习记录 · 峰值 {maxMinutes} 分钟
                  </p>
                </div>
                <span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 font-mono text-[11px] text-cyan-300">
                  分钟 / 天
                </span>
              </div>
              <AreaTrend
                data={dailyMinutes}
                height={210}
                valueFormat={(n) => `${n} 分钟`}
              />
            </motion.div>

            {/* 学科分布 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16 }}
              className="glass rounded-2xl p-5 lg:col-span-2"
            >
              <h2 className="text-[15px] font-semibold text-slate-100">学科分布</h2>
              <p className="mt-1 text-[11px] text-slate-500">按投入时长统计</p>
              <div className="mt-4 flex justify-center">
                <DonutChart
                  data={subjectData}
                  size={170}
                  legendColumns={1}
                  centerLabel="总时长"
                  centerValue={`${subjectData.reduce((s, d) => s + d.value, 0)} 分`}
                />
              </div>
            </motion.div>
          </div>
        )}

        {/* 最近学习 */}
        {courses.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="glass mt-4 rounded-2xl p-5"
          >
            <h2 className="text-[15px] font-semibold text-slate-100">最近在学</h2>
            <div className="mt-4 space-y-2.5">
              {courses.slice(0, 5).map((c) => (
                <div key={c.videoId} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-slate-200">{c.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-600">
                      {c.subject || '未分类'} · {fmtDuration(c.durationSec)}
                    </p>
                  </div>
                  <div className="h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
                      style={{ width: `${Math.min(100, Math.max(2, c.progress))}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[11px] text-cyan-300">
                    {c.progress}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}
