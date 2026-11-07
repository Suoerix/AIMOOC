import { useCallback, useRef, useState } from 'react'

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
    videoTitle?: string
  ) => Promise<void>
  reset: () => void
}

/** 流式读取 response body 的纯文本，onChunk 收到「累计文本」 */
async function readStream(
  res: Response,
  onChunk: (accumulated: string) => void
): Promise<string> {
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

  const generate = useCallback(
    async (
      videoId: string,
      pageNumber?: string | number,
      cookie?: string,
      videoTitle?: string
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

      try {
        const res = await fetch('/api/courseware', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ videoId, pageNumber, cookie, videoTitle }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.errorMessage || `请求失败（${res.status}）`)
        }
        const full = await readStream(res, (accumulated) => {
          // 增量渲染（每次 chunk 都 parse，量级小可接受）
          setSlides(parseCourseware(accumulated))
        })
        setSlides(parseCourseware(full))
        if (typeof window !== 'undefined' && full.trim()) {
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
    []
  )

  const reset = useCallback(() => {
    setSlides([])
    setError(null)
    bufferRef.current = ''
  }, [])

  return { slides, streaming, error, generate, reset }
}
