import OpenAI from 'openai'

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

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
  maxRetries?: number
  timeoutMs?: number
}

function isRetryableError(err: unknown): boolean {
  const status = (err as any)?.status
  if (status === 429 || status === 408) return true
  if (status >= 500 && status < 600) return true
  return err instanceof OpenAI.APIConnectionError
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const maxRetries = opts.maxRetries ?? Number(process.env.OPENAI_MAX_RETRIES ?? 8)
  const timeoutMs =
    opts.timeoutMs ?? Number(process.env.OPENAI_RETRY_TIMEOUT_MS ?? 50000)
  const start = Date.now()
  let attempt = 0

  while (true) {
    try {
      return await fn()
    } catch (err: any) {
      attempt++
      const elapsed = Date.now() - start
      if (!isRetryableError(err) || attempt > maxRetries || elapsed >= timeoutMs) {
        throw err
      }

      const backoff = Math.min(2000 * 2 ** (attempt - 1), 20000)
      const jittered = backoff * (0.8 + Math.random() * 0.4)
      const remaining = timeoutMs - (Date.now() - start)
      const wait = Math.min(jittered, Math.max(remaining - 1000, 500))

      console.warn(
        `[openai retry] attempt ${attempt} failed (status=${err?.status ?? 'network'}), ` +
          `retrying in ${Math.round(wait)}ms, elapsed ${elapsed}ms`
      )
      await new Promise((resolve) => setTimeout(resolve, wait))
    }
  }
}
