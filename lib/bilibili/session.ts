/**
 * B 站登录态的服务端会话管理。
 *
 * 旧实现把完整 Cookie（含 SESSDATA / bili_jct）回传浏览器并明文存 localStorage，
 * 且以 req.body.cookie 由客户端任意提供，服务端不校验归属。
 * 现在改为：凭证只存在于 httpOnly + sameSite=lax 的服务端会话 Cookie 中，
 * JS 读不到，也不能由请求体伪造。
 */

import type { NextApiRequest, NextApiResponse } from 'next'

export const BILI_COOKIE_NAME = 'aimooc_bili_session'
export const BILI_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

function serializeCookie(name: string, value: string, maxAge: number): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

/** 只接受形如 SESSDATA=...; bili_jct=... 的合法 Cookie 串 */
export function normalizeBiliCookie(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.trim().slice(0, 4096)
  if (!value || !/SESSDATA\s*=/.test(value)) return null
  const pairs = value
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
  if (pairs.length === 0 || pairs.length > 40) return null
  for (const pair of pairs) {
    if (!/^[A-Za-z0-9_.-]+\s*=\s*[^\s;]*$/.test(pair)) return null
  }
  return pairs.join('; ')
}

/** 从请求 Cookie 读取登录态（忽略 body 里可能伪造的 cookie 字段） */
export function getBiliSession(req: NextApiRequest): string | undefined {
  const raw = req.cookies?.[BILI_COOKIE_NAME]
  if (!raw) return undefined
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return undefined
  }
  return normalizeBiliCookie(decoded) ?? undefined
}

export function setBiliSession(res: NextApiResponse, cookie: string): boolean {
  const normalized = normalizeBiliCookie(cookie)
  if (!normalized) return false
  appendSetCookie(res, serializeCookie(BILI_COOKIE_NAME, normalized, BILI_COOKIE_MAX_AGE))
  return true
}

export function clearBiliSession(res: NextApiResponse): void {
  appendSetCookie(res, serializeCookie(BILI_COOKIE_NAME, '', 0))
}

function appendSetCookie(res: NextApiResponse, value: string): void {
  const existing = res.getHeader('Set-Cookie')
  const list = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : []
  list.push(value)
  res.setHeader('Set-Cookie', list)
}
