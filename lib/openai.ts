import OpenAI from 'openai'

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export const OPENAI_MAX_TOKENS = Number(process.env.OPENAI_MAX_TOKENS ?? 4096)

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable')
  }
  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    maxRetries: 0,
  })
}

export interface RetryOptions {
  /** 最多重试次数（默认 3） */
  maxRetries?: number
  /** 单次请求超时（默认 45s） */
  timeoutMs?: number
  /** 含重试的总耗时上限（默认 55s，留出余量给 API 路由的 maxDuration） */
  totalTimeoutMs?: number
}

function readEnvInt(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback
}

/** 单次请求超时错误，标记为 408 以便纳入可重试范围 */
class OpenAIRequestTimeoutError extends Error {
  readonly status = 408
  constructor() {
    super('OpenAI request timed out')
    this.name = 'OpenAIRequestTimeoutError'
  }
}

function isRetryableError(err: unknown): boolean {
  const status = (err as any)?.status
  if (status === 429 || status === 408) return true
  if (status >= 500 && status < 600) return true
  return err instanceof OpenAI.APIConnectionError
}

/** 解析上游 429/503 的 Retry-After（秒数或 HTTP 日期），上限 60s，避免无限等待 */
function retryAfterMs(err: unknown): number | null {
  const headers = (err as any)?.headers as (Headers & Record<string, string>) | undefined
  if (!headers) return null
  let raw: string | null = null
  if (typeof (headers as Headers).get === 'function') {
    raw = (headers as Headers).get('retry-after')
  } else {
    raw = headers['retry-after'] ?? headers['Retry-After'] ?? null
  }
  if (!raw) return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) {
    return Math.max(0, Math.min(seconds * 1000, 60_000))
  }
  const when = Date.parse(raw)
  if (!Number.isNaN(when)) {
    return Math.max(0, Math.min(when - Date.now(), 60_000))
  }
  return null
}

/**
 * 带重试的请求包装。
 * fn 可选接收一个 AbortSignal，调用方把它透传给 OpenAI SDK 的 request options，
 * 这样超时能真正中断底层 HTTP 请求；旧的零参 fn 仍然兼容（退化为软超时）。
 */
export async function withRetry<T>(fn: (signal?: AbortSignal) => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const maxRetries = opts.maxRetries ?? readEnvInt('OPENAI_MAX_RETRIES', 3)
  const singleTimeoutMs = opts.timeoutMs ?? readEnvInt('OPENAI_TIMEOUT_MS', 45_000)
  const totalTimeoutMs =
    opts.totalTimeoutMs ?? readEnvInt('OPENAI_TOTAL_TIMEOUT_MS', readEnvInt('OPENAI_RETRY_TIMEOUT_MS', 55_000))
  const startedAt = Date.now()
  let attempt = 0

  for (;;) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    // 单次请求超时：AbortController + setTimeout（不使用 AbortSignal.timeout，兼容旧运行时）
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new OpenAIRequestTimeoutError())
      }, singleTimeoutMs)
    })

    try {
      const result = await Promise.race([fn(controller.signal), timeout])
      if (timer) clearTimeout(timer)
      return result
    } catch (err: any) {
      if (timer) clearTimeout(timer)
      attempt += 1
      const elapsed = Date.now() - startedAt
      if (!isRetryableError(err) || attempt > maxRetries || elapsed >= totalTimeoutMs) {
        throw err
      }

      // 指数退避 + 抖动；429/503 若带 Retry-After 则以其为准
      let wait = Math.min(2000 * 2 ** (attempt - 1), 20_000) * (0.8 + Math.random() * 0.4)
      const serverWait = retryAfterMs(err)
      if (serverWait !== null) wait = Math.max(wait, serverWait)
      const remaining = totalTimeoutMs - (Date.now() - startedAt)
      wait = Math.min(wait, Math.max(remaining - 1000, 500))
      if (wait <= 0) throw err

      console.warn(
        `[openai retry] attempt ${attempt} failed (status=${err?.status ?? 'network'}), ` +
          `retrying in ${Math.round(wait)}ms, elapsed ${elapsed}ms`,
      )
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
}
