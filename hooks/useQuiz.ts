import { useCallback, useState } from 'react'

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
  time: number
}

const CACHE_PREFIX = 'aimooc_quiz_'

export function useQuiz() {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (videoId: string, pageNumber?: string | number, cookie?: string) => {
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
          body: JSON.stringify({ videoId, pageNumber, cookie }),
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.errorMessage || `请求失败（${res.status}）`)
        }
        setQuestions(data.questions || [])
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(cacheKey, JSON.stringify(data))
          } catch {
            /* ignore */
          }
        }
      } catch (e: any) {
        setError(e?.message || '出题失败')
      } finally {
        setLoading(false)
      }
    },
    []
  )

  return { questions, loading, error, generate }
}
