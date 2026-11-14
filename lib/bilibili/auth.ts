import type { BiliUser } from '~/lib/bilibili/server'

/**
 * 前端仅保存公开的用户展示信息，不再保存任何登录凭证。
 * 完整 B 站 Cookie（SESSDATA / bili_jct）只存在于服务端下发的
 * httpOnly 会话 Cookie 中，JS 无法读取，也不能由请求体伪造。
 */
export interface BiliAuth {
  user: BiliUser | null
  savedAt: number
}

const STORAGE_KEY = 'bilibili_user'

export const BILI_AUTH_CHANGE_EVENT = 'bilibili-auth-change'

/** 把任意来源的用户对象规整为固定结构，兼容旧的 face 字段与新的 avatar 字段 */
function normalizeUser(value: unknown): BiliUser | null {
  if (!value || typeof value !== 'object') return null
  const u = value as Record<string, unknown>
  const face = typeof u.face === 'string' ? u.face : typeof u.avatar === 'string' ? u.avatar : ''
  return {
    mid: typeof u.mid === 'number' && Number.isFinite(u.mid) ? u.mid : 0,
    uname: typeof u.uname === 'string' ? u.uname.slice(0, 128) : '',
    face: face.slice(0, 2048),
  }
}

export function getBiliAuth(): BiliAuth | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BiliAuth>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      user: normalizeUser(parsed.user),
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : 0,
    }
  } catch {
    return null
  }
}

/**
 * 保留旧的两参数调用形式 setBiliAuth(cookie, user) 以兼容既有组件：
 * 第一个参数若是字符串（旧凭证）一律忽略，绝不写入本地存储；
 * 新的单参数形式 setBiliAuth(user) 同样可用。
 */
export function setBiliAuth(cookieOrUser: string | BiliUser | null | undefined, maybeUser?: BiliUser | null): BiliAuth {
  const rawUser = typeof cookieOrUser === 'object' && cookieOrUser !== null ? cookieOrUser : maybeUser
  const auth: BiliAuth = { user: normalizeUser(rawUser), savedAt: Date.now() }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth))
    window.dispatchEvent(new CustomEvent(BILI_AUTH_CHANGE_EVENT))
  }
  return auth
}

/** 保留导出以兼容旧调用点；凭证不再暴露给前端，恒返回 undefined */
export function getBiliCookie(): string | undefined {
  return undefined
}

export function clearBiliAuth(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
    window.dispatchEvent(new CustomEvent(BILI_AUTH_CHANGE_EVENT))
  }
  // 通知服务端清除 httpOnly 会话 Cookie，fire-and-forget，不阻塞界面
  try {
    void fetch('/api/bilibili/login/logout', { method: 'POST' })
  } catch {
    // 忽略网络异常
  }
}
