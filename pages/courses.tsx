import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, Plus, Trash2, ArrowRight, ListVideo, Link2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import { Nav } from '~/components/Nav'
import { useCourses } from '~/hooks/useCourses'
import { courseProgress } from '~/lib/course/store'
import type { Course, CourseResolveResult } from '~/lib/course/types'

const HomePage: NextPage = () => {
  const router = useRouter()
  const { courses, save, remove } = useCourses()
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<Course | null>(null)
  const [error, setError] = useState<string | null>(null)

  const build = async () => {
    const text = input.trim()
    if (!text) {
      toast.error('请粘贴合集链接，或多个视频链接（每行一个）')
      return
    }
    setLoading(true)
    setError(null)
    setPreview(null)
    try {
      // 判断是「单个合集链接」还是「多链接」
      const lines = text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
      const payload = lines.length > 1 ? { urls: lines } : { url: text }
      const res = await fetch('/api/course/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as CourseResolveResult
      if (!res.ok || !data.ok || !data.course) {
        setError(data.message || '解析失败，请改用「每行一个视频链接」的方式粘贴。')
        return
      }
      setPreview(data.course)
    } catch {
      setError('网络异常，请稍后重试，或直接逐条粘贴视频链接。')
    } finally {
      setLoading(false)
    }
  }

  const confirmSave = (course: Course) => {
    save(course)
    toast.success('课程已保存到「我的课程」')
    router.push(`/course/${course.id}`)
  }

  return (
    <div className="relative min-h-screen bg-[#040711] text-slate-100">
      <Nav active="courses" />

      <main className="relative z-10 mx-auto max-w-5xl px-5 pb-20 pt-28 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="h-6 w-6 text-cyan-300" />
            课程体系
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            把一个 B站合集 / YouTube 播放列表，或一串视频链接，变成带学习路径的课程。每一集都会接入 AI 教室（总结 / 课件 / 出题 / 助教）。
          </p>
        </motion.div>

        {/* 构建器 */}
        <div className="glass-strong rounded-2xl p-5">
          <label className="mb-2 block text-sm font-medium text-slate-200">
            粘贴合集链接，或多个视频链接（每行一个）
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={5}
            placeholder={
              'B站合集：https://www.bilibili.com/list/mlxxxx\n或 B站多P：https://www.bilibili.com/video/BVxxxx\n或 YouTube 播放列表：https://www.youtube.com/playlist?list=PLxxxx\n\n也可每行一个视频链接：\nhttps://www.bilibili.com/video/BV111\nhttps://www.bilibili.com/video/BV222'
            }
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={build}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-cyan-500/30 transition hover:scale-[1.02] disabled:opacity-50"
            >
              <Link2 className="h-4 w-4" />
              {loading ? '解析中…' : '生成课程'}
            </button>
            <span className="text-xs text-slate-500">
              自动解析失败时会提示你改用「逐条粘贴」模式，完全可用。
            </span>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              {error}
            </div>
          )}

          {/* 预览 */}
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-slate-400">
                    已识别 <span className="text-cyan-200">{preview.episodeCount}</span> 集 · 来源{' '}
                    {preview.sourceType === 'manual' ? '手动' : preview.sourceType === 'bilibili' ? 'B站' : 'YouTube'}
                  </p>
                  <p className="mt-0.5 text-base font-medium text-slate-100">{preview.title}</p>
                </div>
                <button
                  onClick={() => confirmSave(preview)}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-500/20 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
                >
                  <Plus className="h-4 w-4" />
                  保存课程
                </button>
              </div>
              <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto pr-1">
                {preview.episodes.slice(0, 20).map((ep) => (
                  <li key={ep.order} className="flex items-center gap-2 text-[13px] text-slate-300">
                    <span className="w-6 text-right text-slate-500">{ep.order}</span>
                    <span className="truncate">{ep.title}</span>
                  </li>
                ))}
                {preview.episodes.length > 20 && (
                  <li className="text-[12px] text-slate-500">… 还有 {preview.episodes.length - 20} 集</li>
                )}
              </ul>
            </motion.div>
          )}
        </div>

        {/* 我的课程 */}
        <div className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-200">
            <ListVideo className="h-5 w-5 text-cyan-300" />
            我的课程
          </h2>
          {courses.length === 0 ? (
            <p className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">
              还没有课程。在上方粘贴合集链接或视频链接，生成你的第一个课程体系。
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {courses.map((c) => {
                const p = courseProgress(c)
                return (
                  <div key={c.id} className="glass group rounded-2xl p-4 transition hover:border-cyan-400/30">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/course/${c.id}`} className="min-w-0 flex-1">
                        <p className="truncate text-base font-medium text-slate-100">{c.title}</p>
                        <p className="mt-0.5 text-[12px] text-slate-500">
                          {c.episodeCount} 集 · {c.sourceType === 'manual' ? '手动' : c.sourceType === 'bilibili' ? 'B站' : 'YouTube'}
                        </p>
                      </Link>
                      <button
                        onClick={() => remove(c.id)}
                        className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300"
                        aria-label="删除课程"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width: `${p}%` }} />
                    </div>
                    <Link
                      href={`/course/${c.id}`}
                      className="mt-3 flex items-center justify-end gap-1 text-[13px] text-cyan-200 opacity-0 transition group-hover:opacity-100"
                    >
                      进入学习 <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default HomePage
