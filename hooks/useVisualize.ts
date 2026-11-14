import { useCallback, useState } from 'react'
import type { TranscriptItem } from '~/lib/video/types'

// 版本后缀：升级后不再复用旧版（未净化）缓存，避免渲染历史遗留的危险 HTML
const CACHE_PREFIX = 'aimooc_visual_v2_'
// 与服务端 LIMITS.cacheValueChars 保持一致。
// 客户端不直接 import lib/security/input.ts（该模块依赖 sanitize-html，属于 Node 端）。
const MAX_CACHE_VALUE_CHARS = 200_000

/** 提取 LLM 输出中的 HTML 文档（容错：去 Markdown 代码块包裹） */
function extractHtml(text: string): string {
  let t = text.trim()
  // 去 ```html ... ``` 包裹
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:html)?\s*\n?/, '').replace(/\n?```\s*$/, '')
  }
  const start = t.indexOf('<!DOCTYPE')
  if (start > 0) t = t.slice(start)
  else if (start < 0) {
    const htmlStart = t.indexOf('<html')
    if (htmlStart > 0) t = t.slice(htmlStart)
  }
  const end = t.lastIndexOf('</html>')
  if (end >= 0) t = t.slice(0, end + 7)
  return t.trim()
}

export interface UseVisualizeResult {
  html: string | null
  streaming: boolean
  progress: string
  error: string | null
  generate: (
    videoId: string,
    opts?: {
      pageNumber?: string | number
      cookie?: string
      topic?: string
      transcript?: TranscriptItem[]
    },
  ) => Promise<void>
  reset: () => void
}

export function useVisualize(): UseVisualizeResult {
  const [html, setHtml] = useState<string | null>(null)
  const [streaming, setStreaming] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (
      videoId: string,
      opts?: {
        pageNumber?: string | number
        cookie?: string
        topic?: string
        transcript?: TranscriptItem[]
      },
    ) => {
      const cacheKey = `${CACHE_PREFIX}${videoId}_${opts?.pageNumber || 1}`
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          setHtml(cached)
          return
        }
      }

      setStreaming(true)
      setError(null)
      setHtml(null)

      const phases = ['正在分析本课知识点…', '正在设计交互实验…', '正在编写可视化代码…', '正在打磨界面细节…']
      let phaseIdx = 0
      setProgress(phases[0])
      const phaseTimer = setInterval(() => {
        phaseIdx = Math.min(phaseIdx + 1, phases.length - 1)
        setProgress(phases[phaseIdx])
      }, 9000)

      try {
        const res = await fetch('/api/visualize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoId,
            pageNumber: opts?.pageNumber,
            topic: opts?.topic,
            // 统一字幕入口：任意平台字幕经前端转换后直接传给服务端
            transcript: opts?.transcript,
            // cookie 参数仅为兼容旧调用保留；服务端改用 httpOnly 会话，忽略 body.cookie
          }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.errorMessage || `请求失败（${res.status}）`)
        }

        // 服务端已净化，这里只做累积与容错提取
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let full = ''
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            full += decoder.decode(value, { stream: true })
            setProgress(`正在生成交互实验… ${(full.length / 1024).toFixed(1)} KB`)
          }
        } else {
          full = await res.text()
        }

        const parsed = extractHtml(full)
        if (!parsed || !parsed.includes('<')) {
          throw new Error('生成的内容不包含有效 HTML')
        }
        setHtml(parsed)
        // 写 localStorage 前检查大小上限，超限静默跳过
        if (typeof window !== 'undefined' && parsed.length <= MAX_CACHE_VALUE_CHARS) {
          try {
            localStorage.setItem(cacheKey, parsed)
          } catch {
            /* ignore */
          }
        }
      } catch (e: any) {
        setError(e?.message || '可视化生成失败')
      } finally {
        clearInterval(phaseTimer)
        setStreaming(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setHtml(null)
    setError(null)
    setProgress('')
  }, [])

  return { html, streaming, progress, error, generate, reset }
}
