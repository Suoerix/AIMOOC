/**
 * 统一结构化日志。
 * 取代散落在各处的 console.log/error/warn，便于在生产环境统一采集与脱敏。
 * 默认输出到 console；接入日志平台时在此扩展（不阻塞主流程）。
 */

type Level = 'info' | 'warn' | 'error'

function emit(level: Level, scope: string, args: unknown[]): void {
  const ts = new Date().toISOString()
  const prefix = `[${ts}] [${level.toUpperCase()}] [${scope}]`
  if (level === 'error') console.error(prefix, ...args)
  else if (level === 'warn') console.warn(prefix, ...args)
  else console.log(prefix, ...args)
}

export const logger = {
  info: (scope: string, ...args: unknown[]) => emit('info', scope, args),
  warn: (scope: string, ...args: unknown[]) => emit('warn', scope, args),
  error: (scope: string, ...args: unknown[]) => emit('error', scope, args),
}
