/**
 * 字幕文本解析：把 SRT / VTT / 纯文本统一转换为 TranscriptItem[]，并可反向拼回文本。
 * 纯函数，不依赖任何 Node 内置模块，服务端 provider 与浏览器组件均可复用。
 */

import type { TranscriptItem } from '~/lib/video/types'

/**
 * 与 lib/security/input.ts 的 LIMITS.transcriptChars 保持一致。
 * 此处不直接 import，以免把 Node-only 的 sanitize-html 依赖带进浏览器包。
 */
const MAX_TEXT_CHARS = 24_000

function clip(text: string): string {
  if (typeof text !== 'string') return ''
  return text.replace(/^\uFEFF/, '').slice(0, MAX_TEXT_CHARS)
}

/** 解析 hh:mm:ss,mmm / hh:mm:ss.mmm / mm:ss.mmm 等时间轴为秒 */
function toSeconds(token: string): number {
  const parts = token.trim().replace(',', '.').split(':')
  let seconds = 0
  for (let i = 0; i < parts.length; i += 1) {
    const n = Number(parts[i])
    if (!isFinite(n)) return 0
    seconds = seconds * 60 + n
  }
  return isFinite(seconds) ? seconds : 0
}

/** 去掉 VTT 内联标签与常见 HTML 实体，并把多行合并为单行 */
function cleanContent(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

// 时间轴 token：支持可选小时、可选的 ,mmm / .mmm 毫秒
const TIME = '\\d{1,3}:\\d{1,2}(?::\\d{1,2})?(?:[.,]\\d{1,3})?'
const CUE_RE = new RegExp('(' + TIME + ')\\s*-->\\s*(' + TIME + ')')

/** 解析带时间轴的 SRT / VTT 文本，逐行扫描以兼容缺少空行分隔的字幕 */
function parseTimed(text: string): TranscriptItem[] {
  const lines = clip(text).replace(/\r\n?/g, '\n').split('\n')
  const items: TranscriptItem[] = []
  let current: { from: number; to: number; lines: string[] } | null = null

  const flush = () => {
    if (!current) return
    const content = cleanContent(current.lines.join('\n'))
    if (content) {
      const to = current.to > current.from ? current.to : current.from
      items.push({ from: current.from, to, content })
    }
    current = null
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const match = line.match(CUE_RE)
    if (match) {
      flush()
      current = { from: toSeconds(match[1]), to: toSeconds(match[2]), lines: [] }
      continue
    }
    // WEBVTT 头 / NOTE / STYLE / SRT 序号行：未进入字幕块时忽略
    if (!current) continue
    const trimmed = line.trim()
    if (!trimmed || trimmed.toUpperCase() === 'WEBVTT') {
      flush()
      continue
    }
    current.lines.push(line)
  }
  flush()
  return items.sort((a, b) => a.from - b.from)
}

/** 把过长的单行按句末标点切成多个片段 */
function splitLongLine(line: string, out: string[]): void {
  let buf = ''
  for (let i = 0; i < line.length; i += 1) {
    const ch = line.charAt(i)
    buf += ch
    const isBreak = /[。！？!?；;.]/.test(ch)
    if ((isBreak && buf.length >= 12) || buf.length >= 120) {
      out.push(buf.trim())
      buf = ''
    }
  }
  if (buf.trim()) out.push(buf.trim())
}

/** 纯文本按行 / 句自动分段，并按字数估算时间戳（约每 4 字 1 秒） */
function parsePlain(text: string): TranscriptItem[] {
  const lines = clip(text).replace(/\r\n?/g, '\n').split('\n')
  const segments: string[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim()
    if (!line) continue
    if (line.length <= 120) segments.push(line)
    else splitLongLine(line, segments)
  }

  const items: TranscriptItem[] = []
  let cursor = 0
  for (let i = 0; i < segments.length; i += 1) {
    const content = segments[i]
    const duration = Math.max(2, Math.min(20, Math.ceil(content.length / 4)))
    items.push({ from: cursor, to: cursor + duration, content })
    cursor += duration
  }
  return items
}

/**
 * 把字幕文本解析为 TranscriptItem[]。
 * format 为 auto 时，含时间轴走 SRT/VTT 解析，否则按纯文本自动分段。
 */
export function parseSubtitleText(text: string, format: 'auto' | 'srt' | 'vtt' | 'text' = 'auto'): TranscriptItem[] {
  const raw = clip(text)
  if (!raw.trim()) return []
  let fmt = format
  if (fmt === 'auto') fmt = CUE_RE.test(raw) ? 'vtt' : 'text'
  if (fmt === 'srt' || fmt === 'vtt') return parseTimed(raw)
  return parsePlain(raw)
}

function formatTimestamp(sec: number): string {
  const total = Math.max(0, Math.floor(Number(sec) || 0))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number) => (n < 10 ? '0' + n : String(n))
  return h > 0 ? pad(h) + ':' + pad(m) + ':' + pad(s) : pad(m) + ':' + pad(s)
}

/** 把字幕条目拼回纯文本；withTimestamp 为真时每行前置 [mm:ss] 时间戳 */
export function transcriptToText(items: TranscriptItem[], withTimestamp = false): string {
  if (!Array.isArray(items)) return ''
  const lines: string[] = []
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]
    if (!item || typeof item.content !== 'string') continue
    const content = item.content.trim()
    if (!content) continue
    lines.push(withTimestamp ? '[' + formatTimestamp(item.from) + '] ' + content : content)
  }
  return lines.join('\n')
}
