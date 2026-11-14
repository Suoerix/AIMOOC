import type { NextApiRequest, NextApiResponse } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { getServiceClient, isAdminUser } from '~/lib/supabase/server'
import { isSupabaseConfigured } from '~/lib/supabase/client'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'

export const maxDuration = 30

export interface AdminStats {
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

/** 演示数据：未接入 Supabase 时也能看到完整看板形态（前端会标注 DEMO） */
function buildDemoStats(): AdminStats {
  const names = [
    '傅里叶级数：从方波到圆滑曲线',
    '牛顿力学三大定律实战',
    '线性代数：特征值与 eigenvectors',
    'MIT 线性代数 · 第 3 讲',
    '操作系统：进程与调度',
    '有机化学 · 苯环结构',
    '概率论：条件概率与贝叶斯',
    '数据结构：红黑树插入',
  ]
  const subjects = [
    { label: '数学', value: 1840 },
    { label: '物理', value: 1320 },
    { label: '计算机', value: 960 },
    { label: '化学', value: 520 },
    { label: '天文', value: 310 },
    { label: '其他', value: 180 },
  ]

  const daily: AdminStats['daily'] = []
  const dau: AdminStats['dau'] = []
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const label = `${d.getMonth() + 1}/${d.getDate()}`
    const wave = Math.sin((13 - i) / 1.7) * 90 + (13 - i) * 14
    daily.push({ label, value: Math.max(40, Math.round(150 + wave + (i % 4) * 35)) })
    dau.push({ label, value: Math.max(6, Math.round(28 + wave / 3 + (i % 5) * 4)) })
  }

  return {
    demo: true,
    generatedAt: new Date().toISOString(),
    totals: {
      users: 1286,
      sessions: 4318,
      totalHours: 513,
      todayActive: 42,
      avgSessionMin: 7.1,
    },
    daily,
    dau,
    topContent: names.map((title, i) => ({
      label: title,
      value: Math.round(320 - i * 32),
      sub: `${['数学', '物理', '数学', '数学', '计算机', '化学', '数学', '计算机'][i]} · ${
        [86, 74, 69, 61, 55, 42, 38, 31][i]
      } 次学习`,
    })),
    subjects,
  }
}

/** admin_stats() RPC 返回的聚合结构（数据库端算好，不拉明细行） */
interface AdminStatsAggregate {
  users?: number
  sessions?: number
  total_sec?: number
  total_hours?: number
  avg_session_min?: number
  today_active?: number
  daily?: { label: string; value: number }[]
  dau?: { label: string; value: number }[]
  top_content?: { label: string; value: number; sub?: string }[]
  subjects?: { label: string; value: number }[]
}

/** 把数据库聚合结果映射成前端图表使用的响应结构（保持字段结构兼容） */
function fromAggregate(row: AdminStatsAggregate): AdminStats {
  const sessions = Number(row.sessions) || 0
  const totalSec = Number(row.total_sec) || 0
  return {
    demo: false,
    generatedAt: new Date().toISOString(),
    totals: {
      users: Number(row.users) || 0,
      sessions,
      totalHours: row.total_hours != null ? Number(row.total_hours) : Math.round((totalSec / 3600) * 10) / 10,
      todayActive: Number(row.today_active) || 0,
      avgSessionMin:
        row.avg_session_min != null
          ? Number(row.avg_session_min)
          : sessions
          ? Math.round((totalSec / 60 / sessions) * 10) / 10
          : 0,
    },
    daily: Array.isArray(row.daily) ? row.daily : [],
    dau: Array.isArray(row.dau) ? row.dau : [],
    topContent: Array.isArray(row.top_content) ? row.top_content : [],
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
  }
}

/**
 * RPC 不可用时的降级：只做 head-count 查询（PostgREST 不返回任何行）拼出精简统计，
 * 绝不像旧实现那样把最多 5000 行 study_events 拉进应用层内存聚合。
 * 需要 group by 的 topContent / subjects 用 count 查询无法得到，返回空数组。
 */
async function buildFallbackStats(service: SupabaseClient): Promise<AdminStats> {
  const days = 14
  const ranges: { start: string; end: string; label: string }[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date()
    start.setUTCHours(0, 0, 0, 0)
    start.setUTCDate(start.getUTCDate() - i)
    const end = new Date(start.getTime() + 86400_000)
    ranges.push({
      start: start.toISOString(),
      end: end.toISOString(),
      label: `${start.getUTCMonth() + 1}/${start.getUTCDate()}`,
    })
  }

  const { count: users } = await service.from('user_profiles').select('*', { count: 'exact', head: true })

  // 多次小范围 count 查询，彼此并行；head:true 只回计数、不拉行
  const counts = await Promise.all(
    ranges.map((r) =>
      service
        .from('study_events')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', r.start)
        .lt('created_at', r.end),
    ),
  )

  const daily = ranges.map((r, i) => ({ label: r.label, value: counts[i].count || 0 }))
  // 无分组能力时用每日事件数近似趋势 / 日活，属于降级数据
  const dau = daily.map((d) => ({ label: d.label, value: d.value }))
  const sessions = daily.reduce((sum, d) => sum + d.value, 0)

  return {
    demo: false,
    generatedAt: new Date().toISOString(),
    totals: {
      users: users || 0,
      sessions,
      totalHours: 0,
      todayActive: daily.length ? daily[daily.length - 1].value : 0,
      avgSessionMin: 0,
    },
    daily,
    dau,
    topContent: [],
    subjects: [],
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const rejected = rejectMethod(['GET'])
    return res.status(rejected.statusCode).json(rejected.body)
  }

  // ===== 未接入 Supabase：本地降级 demo 数据，不涉真实用户，不做鉴权 =====
  if (!isSupabaseConfigured()) {
    return res.status(200).json(buildDemoStats())
  }

  // ===== 配置后：服务端 getUser() 验签 + 管理员判定，否则 403 =====
  try {
    const supabase = createServerSupabaseClient({ req, res })
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error) logInternalError('admin.stats.getUser', error)
    const admin = await isAdminUser(user ? { id: user.id, email: user.email } : null)
    if (!admin) {
      return res.status(403).json({ errorMessage: '需要管理员权限' })
    }
  } catch (error) {
    logInternalError('admin.stats.auth', error)
    return res.status(403).json({ errorMessage: '需要管理员权限' })
  }

  const service = getServiceClient()
  if (!service) {
    // 已通过鉴权但未配置 service role：无法读真实数据，显式降级为 demo
    logInternalError('admin.stats', 'SUPABASE_SERVICE_ROLE_KEY 未配置')
    return res.status(200).json(buildDemoStats())
  }

  try {
    // 首选：数据库端 SECURITY DEFINER 聚合函数，应用层只拿聚合 JSON，不拉明细行
    const { data, error } = await service.rpc('admin_stats')
    if (!error && data) {
      const row = (Array.isArray(data) ? data[0] : data) as unknown as AdminStatsAggregate
      if (row && typeof row === 'object') {
        return res.status(200).json(fromAggregate(row))
      }
    }
    if (error) logInternalError('admin.stats.rpc', error)

    // RPC 不可用：退回小范围 count 查询，绝不拉 5000 行到内存
    return res.status(200).json(await buildFallbackStats(service))
  } catch (error) {
    logInternalError('admin.stats', error)
    return res.status(500).json({ errorMessage: publicError() })
  }
}
