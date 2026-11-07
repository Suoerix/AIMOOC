import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Clock, FileText, Loader2 } from 'lucide-react'
import type { CoursewareSlide } from '~/hooks/useCourseware'
import { cn } from '~/lib/utils'

interface CoursewareViewProps {
  slides: CoursewareSlide[]
  current: number
  streaming: boolean
  onNav: (index: number) => void
  onJumpVideo: (time: number) => void
  /** 生成失败原因（无字幕 / AI 报错等） */
  error?: string | null
}

function fmtTime(sec: number) {
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

export function CoursewareView({ slides, current, streaming, onNav, onJumpVideo, error }: CoursewareViewProps) {
  const slide = slides[current]
  const isLast = current >= slides.length - 1

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 课件画布 */}
      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {slide ? (
            <motion.div
              key={current}
              initial={{ opacity: 0, x: 36 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.32, ease: [0.21, 1.02, 0.73, 1] }}
              className="flex h-full flex-col items-center justify-center px-6 py-8 sm:px-14"
            >
              {/* 幻灯片标题 */}
              <div className="mb-7 flex items-center gap-3 text-center">
                <span className="rounded-lg bg-cyan-400/10 px-2.5 py-1 font-mono text-[11px] text-cyan-300">
                  {String(current + 1).padStart(2, '0')}
                </span>
                <h2 className="text-xl font-bold leading-snug text-slate-50 sm:text-2xl md:text-[28px]">
                  {slide.title}
                </h2>
                {slide.time != null && slide.time > 0 && (
                  <button
                    onClick={() => onJumpVideo(slide.time as number)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-violet-400/10 px-2.5 py-1 text-[11px] text-violet-300 transition-colors hover:bg-violet-400/20"
                    title="跳转到视频对应位置"
                  >
                    <Clock className="h-3 w-3" />
                    {fmtTime(slide.time)}
                  </button>
                )}
              </div>

              {/* 要点 */}
              <ul className="w-full max-w-2xl space-y-3.5">
                {slide.bullets.map((b, i) => (
                  <motion.li
                    key={`${current}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + i * 0.08, duration: 0.35 }}
                    className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.03] px-4 py-3 text-[14px] leading-relaxed text-slate-200 sm:text-[15px]"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" />
                    {b}
                  </motion.li>
                ))}
                {/* 流式中：正在生成的骨架条 */}
                {streaming && isLast && (
                  <li className="flex items-start gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-cyan-400/60" />
                    <span className="h-4 w-3/5 animate-pulse rounded bg-slate-100/[0.06]" />
                  </li>
                )}
              </ul>
            </motion.div>
          ) : streaming ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-sm">AI 正在把视频改编为课件…</p>
              <div className="w-52 space-y-2.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-3.5 animate-pulse rounded-lg bg-slate-100/[0.05]"
                    style={{ width: `${[70, 95, 60, 85][i]}%`, animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-slate-500">
              <FileText className="h-8 w-8" />
              <p className="text-sm">{error ? '课件生成未完成' : '课件尚未生成'}</p>
              {error && <p className="max-w-sm text-xs leading-relaxed text-slate-600">{error}</p>}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 导航 */}
      {slides.length > 0 && (
        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-4 py-3">
          <button
            onClick={() => onNav(Math.max(0, current - 1))}
            disabled={current === 0}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-slate-100/[0.05] px-4 text-sm text-slate-300 transition-all hover:bg-slate-100/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
            上一页
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5 overflow-x-auto px-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => onNav(i)}
                aria-label={`第 ${i + 1} 页`}
                className={cn(
                  'h-2 shrink-0 rounded-full transition-all',
                  i === current
                    ? 'w-6 bg-gradient-to-r from-cyan-400 to-violet-400'
                    : 'w-2 bg-slate-100/15 hover:bg-slate-100/30'
                )}
              />
            ))}
            {streaming && (
              <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-cyan-400/70" />
            )}
          </div>

          <button
            onClick={() => onNav(Math.min(slides.length - 1, current + 1))}
            disabled={isLast && !streaming}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 text-sm font-medium text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-30 disabled:shadow-none"
          >
            下一页
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
