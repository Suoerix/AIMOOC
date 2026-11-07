import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Rewind, Lightbulb } from 'lucide-react'
import type { QuizQuestion } from '~/hooks/useQuiz'
import { cn } from '~/lib/utils'

interface QuizCardProps {
  quiz: QuizQuestion
  index: number
  total: number
  onAnswer: (correct: boolean) => void
  onJumpVideo?: (time: number) => void
}

const LETTERS = ['A', 'B', 'C', 'D', 'E']

export function QuizCard({ quiz, index, total, onAnswer, onJumpVideo }: QuizCardProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const answered = selected !== null
  const correct = answered && selected === quiz.answer

  const handleSelect = (i: number) => {
    if (answered) return
    setSelected(i)
    onAnswer(i === quiz.answer)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.21, 1.02, 0.73, 1] }}
      className="animate-msg-in rounded-2xl border border-violet-400/25 bg-gradient-to-b from-violet-500/[0.09] to-violet-500/[0.04] p-4"
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="rounded-full bg-violet-400/15 px-2.5 py-0.5 text-[10.5px] font-medium text-violet-300">
          课堂互动 · 第 {index + 1}/{total} 题
        </span>
        {answered && (
          <span className={cn('text-[11px]', correct ? 'text-emerald-300' : 'text-rose-300')}>
            {correct ? '回答正确' : '再想想～'}
          </span>
        )}
      </div>

      <p className="mb-3.5 text-sm font-medium leading-relaxed text-slate-100">
        {quiz.question}
      </p>

      <div className="flex flex-col gap-2">
        {quiz.options.map((opt, i) => {
          const isRight = answered && i === quiz.answer
          const isWrongPick = answered && i === selected && i !== quiz.answer
          return (
            <button
              key={i}
              onClick={() => handleSelect(i)}
              disabled={answered}
              className={cn(
                'flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-[13px] transition-all',
                'min-h-[44px]',
                !answered &&
                  'border-slate-400/15 bg-slate-100/[0.03] text-slate-300 hover:border-violet-400/40 hover:bg-violet-400/10 hover:text-white',
                isRight && 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200',
                isWrongPick && 'border-rose-400/50 bg-rose-400/10 text-rose-200',
                answered && !isRight && !isWrongPick && 'border-transparent bg-slate-100/[0.02] text-slate-500'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
                  !answered && 'bg-slate-400/15 text-slate-400',
                  isRight && 'bg-emerald-400/20 text-emerald-300',
                  isWrongPick && 'bg-rose-400/20 text-rose-300',
                  answered && !isRight && !isWrongPick && 'bg-slate-400/10 text-slate-600'
                )}
              >
                {isRight ? <CheckCircle2 className="h-3.5 w-3.5" /> : isWrongPick ? <XCircle className="h-3.5 w-3.5" /> : LETTERS[i]}
              </span>
              {opt}
            </button>
          )
        })}
      </div>

      {answered && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 overflow-hidden"
        >
          <div className="rounded-xl bg-slate-100/[0.04] p-3 text-[12.5px] leading-relaxed text-slate-300">
            <div className="mb-1 flex items-center gap-1.5 text-amber-300">
              <Lightbulb className="h-3.5 w-3.5" />
              <span className="text-[11px] font-medium">解析</span>
            </div>
            {quiz.explanation}
            {quiz.time > 0 && onJumpVideo && (
              <button
                onClick={() => onJumpVideo(quiz.time)}
                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-cyan-400/10 px-3 py-1.5 text-[11.5px] text-cyan-300 transition-colors hover:bg-cyan-400/20"
              >
                <Rewind className="h-3 w-3" />
                跳回视频 {Math.floor(quiz.time / 60)}:{String(Math.floor(quiz.time % 60)).padStart(2, '0')} 回顾
              </button>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
