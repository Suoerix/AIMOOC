import { useCallback, useState } from 'react'
import type { TranscriptItem } from '~/lib/video/types'

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
  time: number
}

const CACHE_PREFIX = 'aimooc_quiz_'
// 与服务端 LIMITS.cacheValueChars 一致；客户端不 import lib/security/input.ts
const MAX_CACHE_VALUE_CHARS = 200_000

export function useQuiz() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (videoId: string, pageNumber?: string | number, cookie?: string, transcript?: TranscriptItem[]) => {
      const cacheKey = `${CACHE_PREFIX}${videoId}_${pageNumber || 1}`
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(cacheKey)
        if (cached) {
          try {
            const parsed = JSON.parse(cached)
            if (parsed.questions?.length) {
              setQuestions(parsed.questions)
              return
            }
          } catch {
            /* ignore */
          }
        }
      }

      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // 统一字幕入口；cookie 仅为兼容旧调用保留，服务端忽略 body.cookie
          body: JSON.stringify({ videoId, pageNumber, transcript }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.errorMessage || `请求失败（${res.status}）`)
        }
        setQuestions(data.questions || [])
        if (typeof window !== 'undefined') {
          const serialized = JSON.stringify(data)
          // 写 localStorage 前检查大小上限，超限静默跳过
          if (serialized.length <= MAX_CACHE_VALUE_CHARS) {
            try {
              localStorage.setItem(cacheKey, serialized)
            } catch {
              /* ignore */
            }
          }
        }
      } catch (e: any) {
        setError(e?.message || '出题失败')
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { questions, loading, error, generate }
}
