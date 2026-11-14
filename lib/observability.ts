/**
 * 集中式错误上报。
 * 当前用结构化日志落地；接入 Sentry / 自建 APM 时在此扩展即可，
 * 业务代码统一调用 reportError，避免到处 import 具体上报 SDK。
 */

import { logger } from './logger'

export function reportError(scope: string, error: unknown, meta?: Record<string, unknown>): void {
  const detail =
    error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { raw: String(error) }
  logger.error('obs', scope, detail, meta ?? {})
}
