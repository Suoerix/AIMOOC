import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { getServiceClient, isAdminUser } from '~/lib/supabase/server'

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

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  // ===== 未接入 Supabase：直接返回演示数据（此时也没有真实用户数据可泄露） =====
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return res.status(200).json(buildDemoStats())
  }

  // ===== 管理员鉴权 =====
  let email: string | null = null
  try {
    const supabase = createServerSupabaseClient({ req, res })
    const {
      data: { session },
    } = await supabase.auth.getSession()
    email = session?.user?.email ?? null
  } catch {
    /* 未登录 */
  }

  const admin = await isAdminUser(email)
  if (!admin) {
    return res.status(403).json({
      errorMessage: '需要管理员权限',
      hint: '将管理员邮箱加入环境变量 SUPABASE_ADMIN_EMAILS，或在 user_profiles 表中把 role 设为 admin',
    })
  }

  const service = getServiceClient()
  if (!service) {
    return res.status(200).json(buildDemoStats())
  }

  try {
    const days = 14
    const since = new Date(Date.now() - days * 86400_000).toISOString()

    const [{ data: events }, { count: users }] = await Promise.all([
      service
        .from('study_events')
        .select('user_id, video_id, title, subject, duration_sec, created_at')
        .gte('created_at', since)
        .limit(5000),
      service.from('user_profiles').select('*', { count: 'exact', head: true }),
    ])

    const rows = events || []
    const dailyMap = new Map<string, number>()
    const dauMap = new Map<string, Set<string>>()
    const topMap = new Map<string, { label: string; value: number; subject: string; count: number }>()
    const subjectMap = new Map<string, number>()

    const todayKey = new Date().toISOString().slice(0, 10)
    let totalSec = 0
    let todayActive = 0
    const todayUsers = new Set<string>()

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      dailyMap.set(key, 0)
      dauMap.set(key, new Set())
    }

    for (const row of rows as Record<string, any>[]) {
      const key = String(row.created_at).slice(0, 10)
      const minutes = (Number(row.duration_sec) || 0) / 60
      totalSec += Number(row.duration_sec) || 0

      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) || 0) + minutes)
        if (row.user_id) dauMap.get(key)?.add(row.user_id)
      }
      if (key === todayKey && row.user_id) todayUsers.add(row.user_id)

      const vid = String(row.video_id || 'unknown')
      const title = String(row.title || vid)
      const prev = topMap.get(vid)
      if (prev) {
        prev.value += minutes
        prev.count += 1
      } else {
        topMap.set(vid, { label: title, value: minutes, subject: row.subject || '', count: 1 })
      }

      const subject = row.subject || '未分类'
      subjectMap.set(subject, (subjectMap.get(subject) || 0) + minutes)
    }

    todayActive = todayUsers.size

    const daily = Array.from(dailyMap.entries()).map(([key, value]) => ({
      label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
      value: Math.round(value),
    }))
    const dau = Array.from(dauMap.entries()).map(([key, set]) => ({
      label: `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`,
      value: set.size,
    }))

    const topContent = Array.from(topMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)
      .map((t) => ({
        label: t.label,
        value: Math.round(t.value),
        sub: t.subject ? `${t.subject} · ${t.count} 次学习` : `${t.count} 次学习`,
      }))

    const subjects = Array.from(subjectMap.entries())
      .map(([label, value]) => ({ label, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value)

    return res.status(200).json({
      demo: false,
      generatedAt: new Date().toISOString(),
      totals: {
        users: users || 0,
        sessions: rows.length,
        totalHours: Math.round((totalSec / 3600) * 10) / 10,
        todayActive,
        avgSessionMin: rows.length ? Math.round((totalSec / 60 / rows.length) * 10) / 10 : 0,
      },
      daily,
      dau,
      topContent,
      subjects,
    } satisfies AdminStats)
  } catch (error) {
    console.error('admin stats error:', error)
    return res.status(500).json({ errorMessage: '统计数据读取失败' })
  }
}
