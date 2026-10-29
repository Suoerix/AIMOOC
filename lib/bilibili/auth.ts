import type { BiliUser } from '~/lib/bilibili/server'

export interface BiliAuth {
  cookie: string
  user: BiliUser
  savedAt: number
}

const STORAGE_KEY = 'bilibili_auth'

export const BILI_AUTH_CHANGE_EVENT = 'bilibili-auth-change'

export function getBiliAuth(): BiliAuth | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const auth = JSON.parse(raw) as BiliAuth
    if (!auth.cookie) return null
    return auth
  } catch {
    return null
  }
}

export function getBiliCookie(): string | undefined {
  return getBiliAuth()?.cookie
}

export function setBiliAuth(cookie: string, user: BiliUser): BiliAuth {
  const auth: BiliAuth = { cookie, user, savedAt: Date.now() }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
  window.dispatchEvent(new CustomEvent(BILI_AUTH_CHANGE_EVENT))
  return auth
}

export function clearBiliAuth(): void {
  window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(BILI_AUTH_CHANGE_EVENT))
}
