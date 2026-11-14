import { useCallback, useRef, useState } from 'react'
import type { TranscriptItem } from '~/lib/video/types'

export interface CoursewareSlide {
  title: string
  time: number | null // 视频时间戳（秒）
  bullets: string[]
  taNote?: string // AI 助教讲解词
}

export interface UseCoursewareResult {
  slides: CoursewareSlide[]
  streaming: boolean
  error: string | null
  generate: (
    videoId: string,
    pageNumber?: string | number,
    cookie?: string,
    videoTitle?: string,
    transcript?: TranscriptItem[],
  ) => Promise<void>
  reset: () => void
}

// 与服务端 LIMITS.cacheValueChars 一致；客户端不 import lib/security/input.ts（依赖 sanitize-html）
const MAX_CACHE_VALUE_CHARS = 200_000
// 流式期间全量解析的最小间隔，避免每个 chunk 都 parse 导致 O(n²)
const PARSE_THROTTLE_MS = 200

/** 流式读取 response body 的纯文本，onChunk 收到「累计文本」 */
async function readStream(res: Response, onChunk: (accumulated: string) => void): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) {
    const text = await res.text()
    onChunk(text)
    return text
  }
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onChunk(full)
  }
  return full
}

/** 把 #S / #T 行协议增量解析为幻灯片数组 */
export function parseCourseware(text: string): CoursewareSlide[] {
  const slides: CoursewareSlide[] = []
  let current: CoursewareSlide | null = null
  let inNote = false

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd()
    if (!line.trim()) continue

    if (line.startsWith('#S')) {
      inNote = false
      // "#S 标题 | 12.34"
      let rest = line.slice(2).trim()
      let time: number | null = null
      const bar = rest.lastIndexOf('|')
      if (bar >= 0) {
        const maybeTime = parseFloat(rest.slice(bar + 1).trim())
        if (!isNaN(maybeTime)) {
          time = maybeTime
          rest = rest.slice(0, bar).trim()
        }
      }
      current = { title: rest || '（未命名）', time, bullets: [] }
      slides.push(current)
    } else if (line.startsWith('#T')) {
      inNote = true
      const note = line.slice(2).trim()
      if (current) current.taNote = current.taNote ? `${current.taNote}${note}` : note
    } else if (line.startsWith('- ')) {
      inNote = false
      const bullet = line.slice(2).trim()
      if (current && bullet) current.bullets.push(bullet)
    } else {
      // 兼容普通文本行：归入当前幻灯片要点或讲解词
      if (current) {
        if (inNote) current.taNote = `${current.taNote || ''}${line}`.trim()
        else if (line.trim()) current.bullets.push(line.trim())
      }
    }
  }
  return slides
}

const CACHE_PREFIX = 'aimooc_courseware_'

export function useCourseware(): UseCoursewareResult {
  const [slides, setSlides] = useState<CoursewareSlide[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bufferRef = useRef('')
  const lastParseRef = useRef(0)

  const generate = useCallback(
    async (
      videoId: string,
      pageNumber?: string | number,
      cookie?: string,
      videoTitle?: string,
      transcript?: TranscriptItem[],
    ) => {
      const cacheKey = `${CACHE_PREFIX}${videoId}_${pageNumber || 1}`
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          setSlides(parseCourseware(cached))
          return
        }
      }

      setStreaming(true)
      setError(null)
      setSlides([])
      bufferRef.current = ''
      lastParseRef.current = 0

      try {
        const res = await fetch('/api/courseware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // cookie 仅为兼容旧调用保留；服务端改用 httpOnly 会话，忽略 body.cookie
          body: JSON.stringify({ videoId, pageNumber, videoTitle, transcript }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.errorMessage || `请求失败（${res.status}）`)
        }
        const full = await readStream(res, (accumulated) => {
          // 节流：最多每 200ms 全量解析一次，中间只呈现已有幻灯片 / 加载态，
          // 把「每个 chunk 都全量 parse」的 O(n²) 降为按时间片触发的近似 O(n)
          const now = Date.now()
          if (now - lastParseRef.current >= PARSE_THROTTLE_MS) {
            lastParseRef.current = now
            setSlides(parseCourseware(accumulated))
          }
        })
        // 完成时再做一次全量解析，保证最终结果完整
        setSlides(parseCourseware(full))
        if (typeof window !== 'undefined' && full.trim() && full.length <= MAX_CACHE_VALUE_CHARS) {
          try {
            localStorage.setItem(cacheKey, full)
          } catch {
            /* 存储满时忽略 */
          }
        }
      } catch (e: any) {
        setError(e?.message || '课件生成失败')
      } finally {
        setStreaming(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setSlides([])
    setError(null)
    bufferRef.current = ''
    lastParseRef.current = 0
  }, [])

  return { slides, streaming, error, generate, reset }
}
