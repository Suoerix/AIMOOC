import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowUp, Link2, Zap, CornerDownLeft } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { matchCases, TEACHING_CASES } from '~/lib/cases'
import { cn } from '~/lib/utils'

interface ChatEntryProps {
  onOpenCase: (caseId: string) => void
}

interface Bubble {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  { icon: '🎬', text: '我想用 B 站视频学习' },
  { icon: '🚀', text: '帮我理解抛体运动' },
  { icon: '〰️', text: '什么是傅里叶变换' },
  { icon: '🪐', text: '太阳系是怎么运转的' },
]

const BILI_LINK = /(https?:\/\/)?(www\.)?(bilibili\.com\/video\/[A-Za-z0-9]+|b23\.tv\/[A-Za-z0-9]+)/

/** 生成与旧版兼容的学习 id */
function makeLearningId(url: string): string {
  return btoa(url).replace(/[^a-zA-Z0-9]/g, '').substring(0, 9)
}

export function ChatEntry({ onOpenCase }: ChatEntryProps) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [bubbles, setBubbles] = useState<Bubble[]>([])
  const [thinking, setThinking] = useState(false)
  const [linkGlow, setLinkGlink] = useState(false)
  const [suggested, setSuggested] = useState<string[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [bubbles, thinking])

  const send = async (text?: string) => {
    const input = (text ?? value).trim()
    if (!input || thinking) return

    // B 站链接 → 进入 AI 教室
    if (BILI_LINK.test(input)) {
      const match = input.match(BILI_LINK)
      const url = match![0].startsWith('http') ? match![0] : `https://${match![0]}`
      toast.success('已识别视频链接，正在进入 AI 教室…', { icon: '🎬' })
      const id = makeLearningId(url)
      try {
        localStorage.setItem(
          `learning_${id}`,
          JSON.stringify({ url, timestamp: Date.now(), config: {} })
        )
      } catch {
        /* ignore */
      }
      router.push(`/learn/${id}`)
      return
    }

    // 普通需求 → 路由助手
    setValue('')
    setBubbles((prev) => [...prev, { role: 'user', content: input }])
    setSuggested(matchCases(input).map((c) => c.id))
    setThinking(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'router',
          messages: [...bubbles, { role: 'user', content: input }].slice(-8),
        }),
      })
      if (!res.ok) throw new Error()
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let reply = ''
      setBubbles((prev) => [...prev, { role: 'assistant', content: '' }])
      if (reader) {
        while (true) {
          const { done, value: v } = await reader.read()
          if (done) break
          reply += decoder.decode(v, { stream: true })
          const r = reply
          setBubbles((prev) => {
            const next = [...prev]
            next[next.length - 1] = { role: 'assistant', content: r }
            return next
          })
        }
      }
      // 若无回复，给出兜底提示
      if (!reply.trim()) {
        setBubbles((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            role: 'assistant',
            content: '我暂时没有想法，试试粘贴一个 B 站视频链接，或点击下方案例开始体验吧！',
          }
          return next
        })
      }
    } catch {
      setBubbles((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '网络好像出了点问题。你可以直接粘贴 B 站视频链接，或先体验下面的互动案例。',
        },
      ])
    } finally {
      setThinking(false)
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
    setLinkGlink(BILI_LINK.test(e.target.value))
    // 自动高度
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="w-full max-w-3xl">
      {/* 对话气泡区 */}
      <div className="mb-4 flex max-h-64 flex-col gap-3 overflow-y-auto scrollbar-thin">
        <AnimatePresence initial={false}>
          {bubbles.map((b, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className={cn('flex', b.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {b.role === 'assistant' && (
                <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-sm">
                  🎓
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                  b.role === 'user'
                    ? 'rounded-br-md bg-gradient-to-br from-cyan-600/80 to-blue-700/80 text-white shadow-lg shadow-cyan-900/30'
                    : 'glass rounded-bl-md text-slate-200'
                )}
              >
                {b.content || (
                  <span className="inline-flex gap-1">
                    <span className="voice-bar h-3.5 w-0.5 rounded bg-cyan-300" style={{ animationDelay: '0ms' }} />
                    <span className="voice-bar h-3.5 w-0.5 rounded bg-cyan-300" style={{ animationDelay: '150ms' }} />
                    <span className="voice-bar h-3.5 w-0.5 rounded bg-cyan-300" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {thinking && bubbles[bubbles.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-sm">
              🎓
            </div>
            <div className="glass flex items-center gap-2 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm text-slate-400">
              <Zap className="h-3.5 w-3.5 animate-spin" />
              正在思考…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 推荐案例（根据用户需求本地匹配） */}
      <AnimatePresence>
        {suggested.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex flex-wrap gap-2"
          >
            {suggested.map((id) => {
              const c = TEACHING_CASES.find((c) => c.id === id)
              if (!c) return null
              return (
                <button
                  key={id}
                  onClick={() => onOpenCase(id)}
                  className="glass group flex items-center gap-2 rounded-full px-4 py-2 text-xs text-slate-300 transition-all hover:border-cyan-400/40 hover:text-cyan-200"
                >
                  <span>{c.icon}</span>
                  {c.title}
                  <CornerDownLeft className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 输入框 */}
      <motion.div
        layout
        className={cn(
          'glass-strong relative rounded-2xl p-2 shadow-2xl shadow-black/40 transition-all duration-500',
          linkGlow ? 'ring-2 ring-cyan-400/50' : 'ring-1 ring-white/5'
        )}
      >
        {linkGlow && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <div className="animate-beam absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-400/15 to-transparent" />
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="描述你想学的内容，或粘贴 B 站视频链接（bilibili.com / b23.tv）…"
            className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent px-3 py-3.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={() => send()}
            disabled={!value.trim() || thinking}
            className={cn(
              'mb-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all',
              value.trim() && !thinking
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95'
                : 'bg-slate-700/50 text-slate-500'
            )}
            aria-label="发送"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </div>
        {/* 状态行 */}
        <div className="flex items-center justify-between px-3 pb-1.5 pt-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            AI 助教在线
            {linkGlow && (
              <span className="ml-2 inline-flex items-center gap-1 text-cyan-300">
                <Link2 className="h-3 w-3" />
                检测到视频链接
              </span>
            )}
          </div>
          <span className="hidden text-[11px] text-slate-600 sm:block">
            Enter 发送 · Shift+Enter 换行
          </span>
        </div>
      </motion.div>

      {/* 快捷提示 */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.text}
            onClick={() => send(p.text)}
            disabled={thinking}
            className="glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs text-slate-400 transition-all hover:border-slate-400/30 hover:text-slate-200 disabled:opacity-50"
          >
            <span>{p.icon}</span>
            {p.text}
          </button>
        ))}
      </div>
    </div>
  )
}
