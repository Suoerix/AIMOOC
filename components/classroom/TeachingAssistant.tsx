import { forwardRef, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Volume2, VolumeX, Send, Bot, User } from 'lucide-react'
import { QuizCard } from '~/components/classroom/QuizCard'
import type { QuizQuestion } from '~/hooks/useQuiz'
import { useTTS } from '~/hooks/useTTS'
import { cn } from '~/lib/utils'

export interface TAMessage {
  id: string
  role: 'ta' | 'user'
  kind?: 'text' | 'quiz' | 'system'
  content?: string
  quiz?: QuizQuestion
  quizIndex?: number
  time?: number
}

type TTSInstance = ReturnType<typeof useTTS>

interface TeachingAssistantProps {
  messages: TAMessage[]
  quizTotal: number
  onQuizAnswer: (correct: boolean, msgId: string) => void
  onJumpVideo: (time: number) => void
  onUserAsk: (text: string) => void
  thinking: boolean
  tts?: TTSInstance
  className?: string
}

let msgSeq = 0
export function newMsgId() {
  return `m${Date.now()}_${msgSeq++}`
}

// 发送限流：限制单条消息长度与发送频率，避免狂点把提问成本放大
const MAX_ASK_CHARS = 500
const SEND_COOLDOWN_MS = 1000

export const TeachingAssistant = forwardRef<HTMLDivElement, TeachingAssistantProps>(function TeachingAssistant(
  props,
  ref,
) {
  // 外部注入了统一 TTS 实例则直接复用，否则本组件自建一份
  if (props.tts) return <TABody {...props} tts={props.tts} headerRef={ref} />
  return <TALocal {...props} headerRef={ref} />
})

function TALocal({ headerRef, ...props }: TeachingAssistantProps & { headerRef: any }) {
  const localTts = useTTS()
  return <TABody {...props} tts={localTts} headerRef={headerRef} />
}

interface TABodyProps extends TeachingAssistantProps {
  tts: TTSInstance
  headerRef: any
}

function TABody({
  messages,
  quizTotal,
  onQuizAnswer,
  onJumpVideo,
  onUserAsk,
  thinking,
  tts,
  className,
  headerRef,
}: TABodyProps) {
  const [input, setInput] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const lastSendRef = useRef(0)

  // 新消息自动滚底
  useEffect(() => {
    const list = listRef.current
    if (list) {
      const nearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < list.clientHeight * 0.6
      if (nearBottom) list.scrollTo({ top: list.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, thinking])

  const send = () => {
    const text = input.trim().slice(0, MAX_ASK_CHARS)
    if (!text || thinking) return
    // 简单防抖：冷却期内的重复点击（含回车连发）直接忽略
    const now = Date.now()
    if (now - lastSendRef.current < SEND_COOLDOWN_MS) return
    lastSendRef.current = now
    setInput('')
    onUserAsk(text)
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      {/* 助教头部 */}
      <div ref={headerRef} className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="relative">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/40 to-violet-500/40 text-lg">
            🎓
          </div>
          {tts.speaking && (
            <span className="absolute -right-1 -top-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100">小识 · AI 助教</p>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {tts.speaking ? (
              <span className="flex items-end gap-[2px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="voice-bar h-2.5 w-[2.5px] rounded-full bg-emerald-400"
                    style={{ animationDelay: `${i * 120}ms` }}
                  />
                ))}
              </span>
            ) : (
              '互动教学中'
            )}
            <span className="text-slate-700">·</span>
            {tts.mode === 'xfyun' ? '讯飞语音' : '浏览器语音'}
          </p>
        </div>
        <button
          onClick={() => {
            if (tts.enabled) tts.stop()
            tts.setEnabled(!tts.enabled)
          }}
          title={tts.enabled ? '关闭语音讲解' : '开启语音讲解'}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
            tts.enabled
              ? 'bg-cyan-400/15 text-cyan-300 hover:bg-cyan-400/25'
              : 'bg-slate-100/[0.05] text-slate-500 hover:bg-slate-100/10',
          )}
        >
          {tts.enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      {/* 消息流 */}
      <div ref={listRef} className="scrollbar-thin flex-1 space-y-3.5 overflow-y-auto px-4 py-4">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {m.role === 'user' ? (
                <div className="flex justify-end gap-2">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-cyan-600/70 to-blue-700/70 px-3.5 py-2.5 text-[13px] leading-relaxed text-white">
                    {m.content}
                  </div>
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100/[0.08]">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </div>
              ) : m.kind === 'quiz' && m.quiz ? (
                <div className="flex gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30">
                    <Bot className="h-3.5 w-3.5 text-violet-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <QuizCard
                      quiz={m.quiz}
                      index={m.quizIndex ?? 0}
                      total={quizTotal}
                      onAnswer={(correct) => onQuizAnswer(correct, m.id)}
                      onJumpVideo={onJumpVideo}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-sm">
                    🎓
                  </div>
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[13px] leading-relaxed',
                      m.kind === 'system'
                        ? 'border border-cyan-400/20 bg-cyan-400/[0.06] text-cyan-100/90'
                        : 'border border-white/[0.06] bg-white/[0.04] text-slate-200',
                    )}
                  >
                    {m.content}
                    {m.time != null && m.time > 0 && (
                      <button
                        onClick={() => onJumpVideo(m.time as number)}
                        className="mt-1.5 block text-[11.5px] text-cyan-400 hover:underline"
                      >
                        ⏱ 跳到视频 {Math.floor(m.time / 60)}:{String(Math.floor(m.time % 60)).padStart(2, '0')}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <div className="flex gap-2">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-violet-500/30 text-sm">
              🎓
            </div>
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/[0.06] bg-white/[0.04] px-3.5 py-3">
              <span className="flex items-end gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="voice-bar h-1.5 w-1.5 rounded-full bg-cyan-300"
                    style={{ animationDelay: `${i * 140}ms` }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="border-t border-white/[0.06] p-3">
        <div className="glass flex items-end gap-2 rounded-2xl p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                send()
              }
            }}
            rows={1}
            maxLength={MAX_ASK_CHARS}
            placeholder="向助教提问…"
            className="max-h-28 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[13px] text-slate-100 placeholder:text-slate-600 focus:outline-none"
          />
          <button
            onClick={send}
            disabled={!input.trim() || thinking}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all',
              input.trim() && !thinking
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white hover:scale-105 active:scale-95'
                : 'bg-slate-700/40 text-slate-600',
            )}
            aria-label="发送"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
