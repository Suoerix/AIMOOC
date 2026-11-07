import { getSupabase } from '~/lib/supabase'

/** 一门「课」的历史记录（对应 Supabase 表 user_courses） */
export interface CourseRecord {
  videoId: string
  title: string
  subject?: string
  url?: string
  /** 学习进度 0-100 */
  progress: number
  /** 累计学习时长（秒） */
  durationSec: number
  quizRight: number
  quizTotal: number
  /** 最近一次学习时间（毫秒时间戳） */
  lastAt: number
  createdAt: number
}

/** 一条笔记（对应 Supabase 表 study_notes） */
export interface NoteRecord {
  id: string
  videoId: string
  title: string
  content: string
  updatedAt: number
}

const COURSES_KEY = 'aimooc_courses_v1'
const NOTES_KEY = 'aimooc_notes_v1'

// ============================ 本地存储（兜底 / 离线） ============================

function readLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function writeLocal<T>(key: string, items: T[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(items))
  } catch {
    /* 存储满时忽略 */
  }
}

export function listLocalCourses(): CourseRecord[] {
  return readLocal<CourseRecord>(COURSES_KEY).sort((a, b) => b.lastAt - a.lastAt)
}

export function listLocalNotes(): NoteRecord[] {
  return readLocal<NoteRecord>(NOTES_KEY).sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 由视频链接生成稳定的课程 id（与主页跳转保持一致） */
export function learningIdFromUrl(url: string): string {
  try {
    return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 9)
  } catch {
    return url.replace(/[^a-zA-Z0-9]/g, '').slice(-9)
  }
}

/** 构造「继续学习」链接：url 以查询参数携带，教室页会自动写入本地缓存 */
export function resumeHref(record: CourseRecord): string {
  const url = record.url || `https://www.bilibili.com/video/${record.videoId}`
  return `/learn/${learningIdFromUrl(url)}?url=${encodeURIComponent(url)}`
}

// ============================ 云端（Supabase） ============================

async function currentUserId(): Promise<string | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

/** 云端 + 本地合并：云端优先，本地补齐（登录后本地历史也会被同步上云） */
export async function listCourses(): Promise<CourseRecord[]> {
  const supabase = getSupabase()
  const uid = await currentUserId()
  const local = listLocalCourses()
  if (!supabase || !uid) return local

  try {
    const { data, error } = await supabase
      .from('user_courses')
      .select('*')
      .eq('user_id', uid)
      .order('last_at', { ascending: false })
    if (error) throw error

    const remote = (data || []).map((row: Record<string, unknown>) => ({
      videoId: String(row.video_id),
      title: String(row.title || ''),
      subject: (row.subject as string) || undefined,
      url: (row.url as string) || undefined,
      progress: Number(row.progress) || 0,
      durationSec: Number(row.duration_sec) || 0,
      quizRight: Number(row.quiz_right) || 0,
      quizTotal: Number(row.quiz_total) || 0,
      lastAt: new Date(row.last_at as string).getTime() || 0,
      createdAt: new Date(row.created_at as string).getTime() || 0,
    }))

    const merged = new Map<string, CourseRecord>()
    for (const c of [...remote, ...local]) {
      const prev = merged.get(c.videoId)
      if (!prev || c.lastAt > prev.lastAt) merged.set(c.videoId, c)
    }
    return Array.from(merged.values()).sort((a, b) => b.lastAt - a.lastAt)
  } catch {
    return local
  }
}

export async function listNotes(): Promise<NoteRecord[]> {
  const supabase = getSupabase()
  const uid = await currentUserId()
  const local = listLocalNotes()
  if (!supabase || !uid) return local

  try {
    const { data, error } = await supabase
      .from('study_notes')
      .select('*')
      .eq('user_id', uid)
      .order('updated_at', { ascending: false })
    if (error) throw error

    const remote = (data || []).map((row: Record<string, unknown>) => ({
      id: String(row.id),
      videoId: String(row.video_id),
      title: String(row.title || ''),
      content: String(row.content || ''),
      updatedAt: new Date(row.updated_at as string).getTime() || 0,
    }))
    const merged = new Map<string, NoteRecord>()
    for (const n of [...remote, ...local]) {
      const prev = merged.get(n.id)
      if (!prev || n.updatedAt > prev.updatedAt) merged.set(n.id, n)
    }
    return Array.from(merged.values()).sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return local
  }
}

/** 合并/更新一条课程记录：本地立即生效，云端尽力同步 */
export async function saveCourse(
  patch: Partial<CourseRecord> & { videoId: string; title: string }
): Promise<CourseRecord> {
  const now = Date.now()
  const local = listLocalCourses()
  const prev = local.find((c) => c.videoId === patch.videoId)
  const next: CourseRecord = {
    videoId: patch.videoId,
    title: patch.title || prev?.title || '未命名课程',
    subject: patch.subject ?? prev?.subject,
    url: patch.url ?? prev?.url,
    progress: Math.max(patch.progress ?? 0, prev?.progress ?? 0),
    durationSec: (patch.durationSec ?? 0) + (prev?.durationSec ?? 0),
    quizRight: Math.max(patch.quizRight ?? 0, prev?.quizRight ?? 0),
    quizTotal: Math.max(patch.quizTotal ?? 0, prev?.quizTotal ?? 0),
    lastAt: now,
    createdAt: prev?.createdAt ?? now,
  }
  writeLocal(
    COURSES_KEY,
    [...local.filter((c) => c.videoId !== next.videoId), next]
  )

  const supabase = getSupabase()
  const uid = await currentUserId()
  if (supabase && uid) {
    try {
      await supabase.from('user_courses').upsert({
        user_id: uid,
        video_id: next.videoId,
        title: next.title,
        subject: next.subject ?? null,
        url: next.url ?? null,
        progress: next.progress,
        duration_sec: next.durationSec,
        quiz_right: next.quizRight,
        quiz_total: next.quizTotal,
        last_at: new Date(next.lastAt).toISOString(),
      })
    } catch {
      /* 云端失败不影响本地 */
    }
  }
  return next
}

export async function deleteCourse(videoId: string): Promise<void> {
  writeLocal(
    COURSES_KEY,
    listLocalCourses().filter((c) => c.videoId !== videoId)
  )
  const supabase = getSupabase()
  const uid = await currentUserId()
  if (supabase && uid) {
    try {
      await supabase.from('user_courses').delete().eq('user_id', uid).eq('video_id', videoId)
    } catch {
      /* ignore */
    }
  }
}

export async function saveNote(note: Omit<NoteRecord, 'id' | 'updatedAt'> & { id?: string }) {
  const now = Date.now()
  const id = note.id || `n_${now}_${Math.random().toString(36).slice(2, 8)}`
  const next: NoteRecord = {
    id,
    videoId: note.videoId,
    title: note.title || '未命名笔记',
    content: note.content || '',
    updatedAt: now,
  }
  const local = listLocalNotes()
  writeLocal(
    NOTES_KEY,
    [...local.filter((n) => n.id !== id), next]
  )

  const supabase = getSupabase()
  const uid = await currentUserId()
  if (supabase && uid) {
    try {
      await supabase.from('study_notes').upsert({
        id: next.id.startsWith('n_') ? undefined : next.id,
        user_id: uid,
        video_id: next.videoId,
        title: next.title,
        content: next.content,
        updated_at: new Date(now).toISOString(),
      })
    } catch {
      /* ignore */
    }
  }
  return next
}

export async function deleteNote(id: string): Promise<void> {
  writeLocal(
    NOTES_KEY,
    listLocalNotes().filter((n) => n.id !== id)
  )
  const supabase = getSupabase()
  const uid = await currentUserId()
  if (supabase && uid) {
    try {
      await supabase.from('study_notes').delete().eq('user_id', uid).eq('id', id)
    } catch {
      /* ignore */
    }
  }
}

/** 登录后把本地历史一次性同步到云端 */
export async function syncLocalToCloud(): Promise<void> {
  const supabase = getSupabase()
  const uid = await currentUserId()
  if (!supabase || !uid) return

  try {
    const courses = listLocalCourses()
    if (courses.length) {
      await supabase.from('user_courses').upsert(
        courses.map((c) => ({
          user_id: uid,
          video_id: c.videoId,
          title: c.title,
          subject: c.subject ?? null,
          url: c.url ?? null,
          progress: c.progress,
          duration_sec: c.durationSec,
          quiz_right: c.quizRight,
          quiz_total: c.quizTotal,
          last_at: new Date(c.lastAt).toISOString(),
        }))
      )
    }
    const notes = listLocalNotes()
    if (notes.length) {
      await supabase.from('study_notes').upsert(
        notes.map((n) => ({
          user_id: uid,
          video_id: n.videoId,
          title: n.title,
          content: n.content,
          updated_at: new Date(n.updatedAt).toISOString(),
        }))
      )
    }
  } catch {
    /* ignore */
  }
}

/** 汇总学习统计（用于进度页 / 后台） */
export interface StudySummary {
  totalCourses: number
  completedCourses: number
  totalSeconds: number
  streakDays: number
  dailySeconds: { label: string; value: number }[]
  bySubject: { label: string; value: number }[]
}

export function summarize(courses: CourseRecord[]): StudySummary {
  const totalSeconds = courses.reduce((s, c) => s + c.durationSec, 0)
  const completedCourses = courses.filter((c) => c.progress >= 100).length

  // 最近 14 天
  const daily = new Map<string, number>()
  const today = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    daily.set(d.toISOString().slice(0, 10), 0)
  }
  for (const c of courses) {
    const key = new Date(c.lastAt).toISOString().slice(0, 10)
    if (daily.has(key)) daily.set(key, (daily.get(key) || 0) + c.durationSec)
  }

  // 连续学习天数
  const days = new Set(courses.map((c) => new Date(c.lastAt).toISOString().slice(0, 10)))
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    if (days.has(d.toISOString().slice(0, 10))) streak++
    else if (i > 0) break
    else continue
  }

  const bySubjectMap = new Map<string, number>()
  for (const c of courses) {
    const key = c.subject || '未分类'
    bySubjectMap.set(key, (bySubjectMap.get(key) || 0) + Math.max(60, c.durationSec))
  }

  return {
    totalCourses: courses.length,
    completedCourses,
    totalSeconds,
    streakDays: streak,
    dailySeconds: Array.from(daily.entries()).map(([label, value]) => ({ label, value })),
    bySubject: Array.from(bySubjectMap.entries())
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  }
}
