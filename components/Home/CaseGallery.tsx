import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Play } from 'lucide-react'
import type { TeachingCase } from '~/lib/cases'
import { cn } from '~/lib/utils'

interface CaseCardProps {
  teachingCase: TeachingCase
  index: number
  onOpen: (caseId: string) => void
}

/** 案例卡片：live iframe 缩放预览（交互可用） */
export function CaseCard({ teachingCase, index, onOpen }: CaseCardProps) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.35)
  // 预览按固定逻辑视口创作，等比缩放
  const PREVIEW_W = 960
  const PREVIEW_H = 520

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / PREVIEW_W)
    })
    ro.observe(el)
    setScale(el.clientWidth / PREVIEW_W)
    return () => ro.disconnect()
  }, [])

  return (
    <motion.button
      initial={{ opacity: 0, y: 32, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay: (index % 3) * 0.09, ease: [0.21, 1.02, 0.73, 1] }}
      onClick={() => onOpen(teachingCase.id)}
      whileHover={{ y: -6 }}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl text-left',
        'glass-strong transition-shadow duration-300'
      )}
      style={{ boxShadow: `0 0 0 0 ${teachingCase.accent}00` }}
    >
      {/* 悬浮光晕 */}
      <div
        className="pointer-events-none absolute inset-0 z-10 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          boxShadow: `inset 0 0 0 1px ${teachingCase.accent}55, 0 8px 40px ${teachingCase.accent}22`,
        }}
      />

      {/* Live 预览 */}
      <div ref={wrapRef} className="relative aspect-[960/520] w-full overflow-hidden bg-[#050914]">
        <iframe
          srcDoc={teachingCase.html}
          sandbox="allow-scripts allow-forms allow-popups"
          title={teachingCase.title}
          className="absolute left-0 top-0 origin-top-left border-0"
          style={{ width: PREVIEW_W, height: PREVIEW_H, transform: `scale(${scale})` }}
          loading="lazy"
        />
        {/* 遮罩层：预览可交互但点击卡片主体跳转，采用「点击即进入」的轻交互模式 */}
        <div className="absolute inset-0 cursor-pointer" />

        {/* 标签角标 */}
        <div
          className="absolute left-3 top-3 z-20 rounded-full px-2.5 py-1 text-[10.5px] font-medium backdrop-blur-md"
          style={{
            background: `${teachingCase.accent}26`,
            color: teachingCase.accent,
            border: `1px solid ${teachingCase.accent}44`,
          }}
        >
          {teachingCase.subject}
        </div>

        {/* 悬浮播放按钮 */}
        <div
          className="absolute bottom-3 right-3 z-20 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full opacity-0 backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100"
          style={{
            background: `${teachingCase.accent}30`,
            border: `1px solid ${teachingCase.accent}66`,
            color: teachingCase.accent,
          }}
        >
          <Play className="h-[18px] w-[18px]" fill="currentColor" />
        </div>
      </div>

      {/* 文本区 */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">{teachingCase.icon}</span>
          <h3 className="text-[15px] font-semibold text-slate-100">
            {teachingCase.title}
          </h3>
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-slate-400">
          {teachingCase.description}
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {teachingCase.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md bg-slate-100/[0.06] px-2 py-0.5 text-[10.5px] text-slate-500"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </motion.button>
  )
}

interface CaseGalleryProps {
  cases: TeachingCase[]
  onOpen: (caseId: string) => void
}

export function CaseGallery({ cases, onOpen }: CaseGalleryProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cases.map((c, i) => (
        <CaseCard key={c.id} teachingCase={c} index={i} onOpen={onOpen} />
      ))}
    </div>
  )
}
