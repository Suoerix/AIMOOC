import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  Users,
  Clock,
  Activity,
  Trophy,
  RefreshCw,
  ShieldCheck,
  Flame,
  BookOpen,
  Loader2,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Nav } from '~/components/Nav'
import {
  AreaTrend,
  BarSeries,
  DonutChart,
  RankBars,
  StatTile,
} from '~/components/admin/Charts'
import { useAuth } from '~/lib/supabase/auth-context'

interface StatsResponse {
  demo: boolean
  generatedAt: string
  totals: {
    users: number
    sessions: number
    totalHours: number
    todayActive: number
    avgSessionMin: number
  }
  daily: { label: string; value: number }[]
  dau: { label: string; value: number }[]
  topContent: { label: string; value: number; sub?: string }[]
  subjects: { label: string; value: number }[]
}

const SUBJECT_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#f87171']

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<StatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setDenied(null)
    try {
      const res = await fetch('/api/admin/stats')
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}))
        setDenied(data.errorMessage || '需要管理员权限')
        return
      }
      if (!res.ok) throw new Error('统计数据加载失败')
      const data = (await res.json()) as StatsResponse
      setStats(data)
    } catch (e: any) {
      toast.error(e?.message || '统计数据加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authLoading) return
    load()
  }, [authLoading, load])

  const subjectData =
    stats?.subjects.slice(0, 6).map((s, i) => ({
      label: s.label,
      value: s.value,
      color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
    })) || []

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <Nav active="admin" />

      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-[92px] sm:px-6">
        {/* 标题 */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                数据<span className="text-gradient-cyan-violet">看板</span>
              </h1>
              {stats?.demo && (
                <span className="rounded-lg border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
                  DEMO · 演示数据
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-500">
              用户规模、学习时长与热门内容 —— 平台运营的全景视图
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-white/[0.05] px-4 text-[13px] text-slate-300 transition-colors hover:bg-white/[0.09] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            刷新数据
          </button>
        </motion.div>

        {/* 无权限 */}
        {denied && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-6 py-16 text-center"
          >
            <ShieldCheck className="h-10 w-10 text-slate-600" />
            <div>
              <p className="text-sm font-medium text-slate-200">{denied}</p>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-500">
                把管理员邮箱加入环境变量 <code className="text-cyan-300">SUPABASE_ADMIN_EMAILS</code>
                ，或在 Supabase 的 <code className="text-cyan-300">user_profiles</code>{' '}
                表中把该账号的 <code className="text-cyan-300">role</code> 设为{' '}
                <code className="text-cyan-300">admin</code>。
              </p>
            </div>
            {!user && (
              <p className="text-[11px] text-slate-600">当前未登录 —— 请先登录管理员账号</p>
            )}
          </motion.div>
        )}

        {/* 加载中 */}
        {!denied && loading && !stats && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="glass h-28 animate-pulse rounded-2xl" />
            ))}
          </div>
        )}

        {stats && (
          <>
            {/* 指标卡 */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
              <StatTile
                label="注册用户"
                value={stats.totals.users.toLocaleString('zh-CN')}
                icon={<Users className="h-4 w-4" />}
                hint={`累计 ${stats.totals.sessions.toLocaleString('zh-CN')} 次学习`}
              />
              <StatTile
                label="总学习时长"
                value={`${stats.totals.totalHours} h`}
                icon={<Clock className="h-4 w-4" />}
                accent="#a78bfa"
                hint="所有课程累计投入"
              />
              <StatTile
                label="今日活跃"
                value={stats.totals.todayActive.toLocaleString('zh-CN')}
                icon={<Flame className="h-4 w-4" />}
                accent="#fb923c"
                hint="今日有学习行为的用户"
              />
              <StatTile
                label="平均单次时长"
                value={`${stats.totals.avgSessionMin} 分钟`}
                icon={<Trophy className="h-4 w-4" />}
                accent="#34d399"
                hint="一次学习的平均投入"
              />
            </motion.div>

            {/* 趋势 + 日活 */}
            <div className="mt-4 grid gap-4 lg:grid-cols-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.06 }}
                className="glass rounded-2xl p-5 lg:col-span-3"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-100">
                      学习时长趋势
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">最近 14 天累计分钟数</p>
                  </div>
                  <span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 font-mono text-[11px] text-cyan-300">
                    分钟 / 天
                  </span>
                </div>
                <AreaTrend data={stats.daily} height={220} valueFormat={(n) => `${n} 分钟`} />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.12 }}
                className="glass rounded-2xl p-5 lg:col-span-2"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-100">日活跃用户</h2>
                    <p className="mt-1 text-[11px] text-slate-500">每日有学习行为的用户数</p>
                  </div>
                  <Activity className="h-4 w-4 text-slate-600" />
                </div>
                <BarSeries data={stats.dau} height={220} color="#a78bfa" />
              </motion.div>
            </div>

            {/* 热门内容 + 学科分布 */}
            <div className="mt-4 grid gap-4 lg:grid-cols-5">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.16 }}
                className="glass rounded-2xl p-5 lg:col-span-3"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-100">
                      热门学习内容 Top 10
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-500">按累计学习时长排序</p>
                  </div>
                  <BookOpen className="h-4 w-4 text-slate-600" />
                </div>
                <RankBars
                  data={stats.topContent}
                  valueFormat={(n) => `${n} 分钟`}
                />
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: 0.2 }}
                className="glass rounded-2xl p-5 lg:col-span-2"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-slate-100">学科分布</h2>
                    <p className="mt-1 text-[11px] text-slate-500">各学科学习时长占比</p>
                  </div>
                  <BarChart3 className="h-4 w-4 text-slate-600" />
                </div>
                <div className="flex justify-center">
                  <DonutChart
                    data={subjectData}
                    size={210}
                    centerLabel="总时长"
                    centerValue={`${subjectData.reduce((s, d) => s + d.value, 0)} 分`}
                  />
                </div>
              </motion.div>
            </div>

            {/* 数据源说明 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.26 }}
              className="glass mt-4 rounded-2xl p-5"
            >
              <h2 className="text-[14px] font-semibold text-slate-200">数据来源说明</h2>
              <div className="mt-3 grid gap-3 text-[12px] leading-relaxed text-slate-500 sm:grid-cols-3">
                <p>
                  <span className="text-slate-300">埋点：</span>
                  教室页每 30 秒上报一次学习事件到{' '}
                  <code className="text-cyan-300">study_events</code> 表，记录课程、学科与停留时长。
                </p>
                <p>
                  <span className="text-slate-300">聚合：</span>
                  <code className="text-cyan-300">/api/admin/stats</code>{' '}
                  使用 service role 读取并聚合，仅管理员可访问。
                </p>
                <p>
                  <span className="text-slate-300">权限：</span>
                  管理员由 <code className="text-cyan-300">SUPABASE_ADMIN_EMAILS</code>{' '}
                  白名单或 <code className="text-cyan-300">user_profiles.role</code> 判定。
                </p>
              </div>
              {stats.demo && (
                <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11.5px] text-amber-200/80">
                  当前展示的是演示数据。配置 Supabase（NEXT_PUBLIC_SUPABASE_URL /
                  SUPABASE_SERVICE_ROLE_KEY）并执行 supabase/schema.sql 后，这里将显示真实数据。
                </p>
              )}
            </motion.div>
          </>
        )}
      </main>
    </div>
  )
}
