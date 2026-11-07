import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { StickyNote, Search, Trash2, Save, Plus, Clock, X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { Nav } from '~/components/Nav'
import { deleteNote, listNotes, saveNote, type NoteRecord } from '~/lib/history'
import { cn } from '~/lib/utils'

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [keyword, setKeyword] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')

  useEffect(() => {
    let alive = true
    listNotes()
      .then((list) => {
        if (!alive) return
        setNotes(list)
        setLoading(false)
      })
      .catch(() => setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return notes
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw)
    )
  }, [notes, keyword])

  const startEdit = (note: NoteRecord) => {
    setEditing(note.id)
    setDraft(note.content)
  }

  const commit = async (note: NoteRecord) => {
    await saveNote({
      id: note.id,
      videoId: note.videoId,
      title: note.title,
      content: draft,
    })
    setNotes((prev) =>
      prev.map((n) => (n.id === note.id ? { ...n, content: draft, updatedAt: Date.now() } : n))
    )
    setEditing(null)
    toast.success('笔记已保存')
  }

  const create = async () => {
    if (!newTitle.trim()) {
      toast.error('给笔记起个标题吧')
      return
    }
    const note = await saveNote({
      videoId: 'general',
      title: newTitle.trim(),
      content: newContent,
    })
    setNotes((prev) => [note, ...prev])
    setNewTitle('')
    setNewContent('')
    setCreating(false)
    toast.success('已创建笔记')
  }

  const remove = async (note: NoteRecord) => {
    await deleteNote(note.id)
    setNotes((prev) => prev.filter((n) => n.id !== note.id))
    toast.success('笔记已删除')
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <Nav active="notes" />

      <main className="relative mx-auto max-w-4xl px-4 pb-20 pt-[92px] sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-wrap items-end justify-between gap-4"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              我的<span className="text-gradient-cyan-violet">笔记</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              课堂里随手记下的想法，都在这里沉淀
            </p>
          </div>
          <button
            onClick={() => setCreating((v) => !v)}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 text-[13px] font-medium text-white transition-transform hover:scale-105"
          >
            {creating ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {creating ? '取消' : '新建笔记'}
          </button>
        </motion.div>

        {/* 新建 */}
        {creating && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="glass mt-6 overflow-hidden rounded-2xl p-4"
          >
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="笔记标题，例如：傅里叶级数的直觉理解"
              className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] px-3.5 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
            />
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={5}
              placeholder="写下你的理解、疑问或延伸思考…"
              className="mt-3 w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5 text-sm leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
            />
            <div className="mt-3 flex justify-end">
              <button
                onClick={create}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-5 text-[13px] font-medium text-white transition-transform hover:scale-105"
              >
                <Save className="h-4 w-4" />
                保存笔记
              </button>
            </div>
          </motion.div>
        )}

        {/* 搜索 */}
        <div className="glass mt-6 flex h-11 items-center gap-2 rounded-xl px-3">
          <Search className="h-4 w-4 text-slate-600" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索笔记内容…"
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
        </div>

        {/* 列表 */}
        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="glass h-24 animate-pulse rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/[0.08] px-6 py-16 text-center">
            <StickyNote className="h-10 w-10 text-slate-700" />
            <div>
              <p className="text-sm font-medium text-slate-300">
                {notes.length === 0 ? '还没有笔记' : '没有匹配的笔记'}
              </p>
              <p className="mt-1.5 text-xs text-slate-600">
                {notes.length === 0
                  ? '在 AI 教室里点「记笔记」，或在这里新建一条'
                  : '换个关键词试试'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {filtered.map((note, i) => (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.25) }}
                className="glass rounded-2xl p-4 transition-colors hover:border-cyan-400/25"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[14.5px] font-semibold text-slate-100">{note.title}</h3>
                  <div className="flex shrink-0 items-center gap-1">
                    {editing === note.id ? (
                      <>
                        <button
                          onClick={() => commit(note)}
                          className="flex h-8 items-center gap-1 rounded-lg bg-cyan-500/20 px-2.5 text-[12px] text-cyan-200 transition-colors hover:bg-cyan-500/30"
                        >
                          <Save className="h-3.5 w-3.5" />
                          保存
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06]"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(note)}
                          className="rounded-lg px-2.5 py-1.5 text-[12px] text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => remove(note)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {editing === note.id ? (
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={4}
                    className="mt-3 w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[13.5px] leading-relaxed text-slate-100 focus:border-cyan-400/40 focus:outline-none"
                  />
                ) : (
                  <p
                    className={cn(
                      'mt-2 whitespace-pre-wrap text-[13.5px] leading-relaxed text-slate-400',
                      !note.content && 'italic text-slate-600'
                    )}
                  >
                    {note.content || '（空笔记，点「编辑」开始记录）'}
                  </p>
                )}

                <p className="mt-3 flex items-center gap-1 text-[11px] text-slate-600">
                  <Clock className="h-3 w-3" />
                  {new Date(note.updatedAt).toLocaleString('zh-CN')}
                  {note.videoId && note.videoId !== 'general' && (
                    <span className="ml-1 rounded bg-white/[0.05] px-1.5 py-0.5">
                      来自课程 {note.videoId}
                    </span>
                  )}
                </p>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
