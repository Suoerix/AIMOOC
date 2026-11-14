/**
 * 字幕导入面板：三种输入方式（粘贴字幕文本 / 上传字幕文件 / 粘贴纯文本自动分段）。
 * 全部在浏览器本地解析，解析结果通过 onApply 回调交给课堂页面。
 */

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { AlignLeft, ClipboardList, FileUp, X } from 'lucide-react'
import type { TranscriptItem } from '~/lib/video/types'
import { parseSubtitleText } from '~/utils/subtitleParser'
import { cn } from '~/lib/utils'

interface TranscriptPanelProps {
  onApply: (items: TranscriptItem[]) => void
  onClose?: () => void
  notice?: string
}

type InputMode = 'subtitle' | 'file' | 'plain'
type SubtitleFormat = 'auto' | 'srt' | 'vtt' | 'text'

/** 与服务端 LIMITS.transcriptChars 对齐的输入上限 */
const MAX_CHARS = 24_000

function formatFromFileName(name: string): SubtitleFormat {
  if (/\.vtt$/i.test(name)) return 'vtt'
  if (/\.srt$/i.test(name)) return 'srt'
  return 'text'
}

function formatTime(sec: number): string {
  const total = Math.max(0, Math.floor(Number(sec) || 0))
  const m = Math.floor(total / 60)
  const s = total % 60
  return (m < 10 ? '0' + m : String(m)) + ':' + (s < 10 ? '0' + s : String(s))
}

export default function TranscriptPanel({ onApply, onClose, notice }: TranscriptPanelProps) {
  const [mode, setMode] = useState<InputMode>('subtitle')
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [preview, setPreview] = useState<TranscriptItem[]>([])
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetFeedback = () => {
    setPreview([])
    setError('')
  }

  const handleModeChange = (next: InputMode) => {
    setMode(next)
    resetFeedback()
  }

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    resetFeedback()
  }

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : ''
      setText(content.slice(0, MAX_CHARS))
      setFileName(file.name)
      resetFeedback()
    }
    reader.onerror = () => setError('文件读取失败，请重试')
    reader.readAsText(file)
  }

  const currentFormat = (): SubtitleFormat => {
    if (mode === 'plain') return 'text'
    if (mode === 'file') return formatFromFileName(fileName)
    return 'auto'
  }

  const parseCurrent = (): TranscriptItem[] | null => {
    if (!text.trim()) {
      setError('请先粘贴字幕内容或选择文件')
      return null
    }
    const items = parseSubtitleText(text, currentFormat())
    if (!items.length) {
      setError('未能解析出字幕条目，请检查内容格式')
      setPreview([])
      return null
    }
    setError('')
    return items
  }

  const handlePreview = () => {
    const items = parseCurrent()
    if (items) setPreview(items)
  }

  const handleApply = () => {
    const items = parseCurrent()
    if (!items) return
    onApply(items)
    onClose?.()
  }

  const tabs: { key: InputMode; label: string; icon: typeof ClipboardList }[] = [
    { key: 'subtitle', label: '粘贴字幕', icon: ClipboardList },
    { key: 'file', label: '上传文件', icon: FileUp },
    { key: 'plain', label: '纯文本', icon: AlignLeft },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 text-slate-100">
      {/* 标题与关闭 */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">导入字幕</p>
          <p className="mt-0.5 text-[11px] text-slate-500">导入后 AI 课件、助教问答、测验等功能即可正常使用</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 平台提示 */}
      {notice && (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-[12px] leading-relaxed text-amber-200/90">
          {notice}
        </div>
      )}

      {/* 输入方式 */}
      <div className="flex items-center gap-1.5 rounded-xl bg-white/[0.04] p-1">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => handleModeChange(tab.key)}
              className={cn(
                'flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12px] font-medium transition-colors',
                mode === tab.key ? 'bg-white/[0.1] text-white' : 'text-slate-400 hover:text-slate-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* 文件上传 */}
      {mode === 'file' && (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".srt,.vtt,.txt,text/plain"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-5 text-[12px] text-slate-300 transition-colors hover:border-cyan-400/40 hover:text-cyan-200"
          >
            <FileUp className="h-4 w-4" />
            {fileName || '选择 .srt / .vtt / .txt 字幕文件'}
          </button>
        </div>
      )}

      {/* 文本区：三种模式共用，便于查看并微调文件内容 */}
      <textarea
        value={text}
        onChange={handleTextChange}
        maxLength={MAX_CHARS}
        rows={7}
        placeholder={
          mode === 'plain'
            ? '粘贴课程文字稿或笔记，将按行 / 句自动分段…'
            : '粘贴 SRT / VTT 字幕文本，或粘贴任意字幕内容自动识别…'
        }
        className="min-h-[120px] w-full flex-1 resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[12px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
      />

      {/* 错误与预览 */}
      {error && <p className="text-[11px] text-rose-300">{error}</p>}
      {preview.length > 0 && (
        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-3">
          <p className="mb-1.5 text-[11px] text-slate-400">已解析 {preview.length} 条，预览前 3 条</p>
          <div className="space-y-1">
            {preview.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="shrink-0 font-mono text-cyan-300/80">{formatTime(item.from)}</span>
                <span className="truncate text-slate-300">{item.content}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 操作栏 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-600">
          {text.length} / {MAX_CHARS} 字
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="h-9 rounded-xl bg-white/[0.06] px-3 text-[12px] text-slate-300 transition-colors hover:bg-white/[0.12]"
          >
            预览解析
          </button>
          <button
            onClick={handleApply}
            disabled={!text.trim()}
            className="h-9 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 text-[12px] font-medium text-white transition-transform hover:scale-105 disabled:opacity-40"
          >
            应用字幕
          </button>
        </div>
      </div>
    </div>
  )
}
