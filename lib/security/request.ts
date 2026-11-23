/**
 * 请求侧的安全工具：身份 key、方法校验、错误脱敏。
 * Edge middleware（NextRequest）与 Node API（NextApiRequest）共用。
 */

import type { NextApiRequest } from 'next'
import type { NextRequest } from 'next/server'
import { logger } from '../logger'

type AnyRequest = NextRequest | NextApiRequest

function header(req: AnyRequest, name: string): string | undefined {
  const h = req.headers as Record<string, string | string[] | undefined> | Headers
  if (h instanceof Headers) return h.get(name) ?? undefined
  const v = h[name]
  return Array.isArray(v) ? v[0] : v
}

/**
 * 生成限流用的客户端标识。
 *
 * 不再直接信任 x-forwarded-for 的首段（客户端可任意伪造，换头即重置额度）。
 * 优先级：平台注入的 req.ip > x-real-ip > x-forwarded-for 的最后一跳 > 固定兜底。
 * 返回的是哈希后的短串，避免把真实 IP 写进日志或 Redis key。
 */
export function clientIpKey(req: AnyRequest): string {
  const platformIp = (req as NextRequest).ip
  const realIp = header(req, 'x-real-ip')
  const forwarded = header(req, 'x-forwarded-for')
  const lastHop = forwarded
    ?.split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(-1)[0]
  const raw = platformIp || realIp || lastHop || 'unknown'
  return `ip:${fnv1a(raw)}`
}

/** 轻量非加密哈希，仅用于生成稳定的限流 key */
export function fnv1a(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36)
}

export function methodAllowed(req: AnyRequest, methods: readonly string[]): boolean {
  return !!req.method && methods.includes(req.method.toUpperCase())
}

export function rejectMethod(methods: readonly string[]): { statusCode: number; body: { errorMessage: string } } {
  return { statusCode: 405, body: { errorMessage: `仅支持 ${methods.join(' / ')} 请求` } }
}

/** 上游错误只在服务端记录，返回给客户端的一律是通用文案 */
export function logInternalError(scope: string, error: unknown): void {
  logger.error(scope, error instanceof Error ? `${error.name}: ${error.message}` : String(error))
}

/**
 * 匿名访客调用 supabase.auth.getUser() 时会返回 AuthSessionMissingError，
 * 这是「未登录」这一正常分支，不是故障；记成 ERROR 会污染错误看板、干扰排障。
 */
export function isMissingAuthSession(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: unknown }).name
  const message = (error as { message?: unknown }).message
  return (
    name === 'AuthSessionMissingError' ||
    (typeof message === 'string' && /auth session missing/i.test(message))
  )
}

export function publicError(fallback = '服务暂时不可用，请稍后重试'): string {
  return fallback
}

/** 粗略估算已解析 body 的体积，阻挡超大 payload 打进大模型 */
export function bodySizeChars(body: unknown): number {
  if (body == null) return 0
  if (typeof body === 'string') return body.length
  try {
    return JSON.stringify(body).length
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

export function isBodyTooLarge(body: unknown, maxChars = 120_000): boolean {
  return bodySizeChars(body) > maxChars
}
