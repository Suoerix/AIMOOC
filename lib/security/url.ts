/**
 * 统一 URL 安全校验。
 *
 * 用于消除仓库里多处「url.includes('b23.tv') 就直接 fetch」导致的 SSRF：
 * 任何由用户输入提供的地址，在进入服务端 fetch 之前都必须经过这里。
 * 该模块同时被 Edge middleware 与 Node API 使用，因此只依赖全局 URL / fetch，
 * 不引入任何 node: 内置模块。
 */

/** 明确的内网 / 云元数据 / 保留地址特征 */
const PRIVATE_IPV4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^192\.0\.[02]\./,
  /^198\.1[89]\./,
  /^2(2[4-9]|3\d)\./,
  /^255\./,
]

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'instance-data.ec2.internal',
  '169.254.169.254',
  '[::1]',
  '::1',
])

/** B 站及字幕 CDN 允许访问的域名 */
export const BILIBILI_HOSTS = [
  'bilibili.com',
  'b23.tv',
  'api.bilibili.com',
  'passport.bilibili.com',
  'hdslb.com',
  'biliapi.net',
  'biliapi.com',
  'akamaized.net',
]

/** 视频源解析允许访问的域名（oEmbed / 字幕等公开接口） */
export const VIDEO_HOSTS = [
  ...BILIBILI_HOSTS,
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'googlevideo.com',
  'vimeo.com',
  'player.vimeo.com',
  'vimeocdn.com',
  'douyin.com',
  'iesdouyin.com',
  'ixigua.com',
  'v.qq.com',
  'youku.com',
  'iqiyi.com',
  'bilibili.tv',
]

export function isPrivateHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (!h || BLOCKED_HOSTNAMES.has(h)) return true
  if (h.endsWith('.localhost') || h.endsWith('.internal') || h.endsWith('.local')) return true
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return PRIVATE_IPV4.some((re) => re.test(h))
  // IPv4 以十进制 / 八进制 / 十六进制书写时同样拒绝
  if (/^0x[0-9a-f]+$/i.test(h) || /^\d{8,12}$/.test(h)) return true
  if (h.includes(':')) return true // IPv6 一律拒绝，避免 ::ffff:169.254.169.254 之类的绕过
  return false
}

/** 解析并检查为「可安全外联」的绝对 URL；不合法返回 null */
export function parseSafeUrl(raw: unknown, options: { allowHttp?: boolean } = {}): URL | null {
  if (typeof raw !== 'string' || raw.length > 2048 || !raw.trim()) return null
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && !(options.allowHttp && u.protocol === 'http:')) return null
  if (u.username || u.password) return null // 拒绝 userinfo 走私
  if (u.port && !['80', '443'].includes(u.port)) return null
  if (isPrivateHost(u.hostname)) return null
  return u
}

/**
 * 域名白名单匹配：必须精确相等或是其真实子域。
 * 不能用 includes —— 'bilibili.com.evil.com' 会命中 includes。
 */
export function hostMatches(hostname: string, allowedHosts: readonly string[]): boolean {
  const h = hostname.toLowerCase()
  return allowedHosts.some((d) => {
    const domain = d.toLowerCase()
    return h === domain || h.endsWith(`.${domain}`)
  })
}

/** 校验 URL 是否落在允许域名内 */
export function isAllowedUrl(
  raw: unknown,
  allowedHosts: readonly string[],
  options?: { allowHttp?: boolean },
): boolean {
  const u = parseSafeUrl(raw, options)
  return !!u && hostMatches(u.hostname, allowedHosts)
}

/**
 * 逐跳跟随重定向，每一跳都重新校验域名，杜绝
 * 「首跳合法、302 到内网」以及开放重定向造成的 SSRF。
 */
export async function safeResolveRedirect(
  raw: string,
  allowedHosts: readonly string[],
  maxRedirects = 4,
): Promise<URL | null> {
  let current = parseSafeUrl(raw)
  if (!current || !hostMatches(current.hostname, allowedHosts)) return null

  for (let i = 0; i < maxRedirects; i += 1) {
    let response: Response
    try {
      response = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AIMOOC/2.0)', Accept: '*/*' },
      })
    } catch {
      return null
    }
    const status = response.status
    if (status >= 300 && status < 400) {
      const location = response.headers.get('location')
      if (!location) return null
      const next = parseSafeUrl(new URL(location, current).toString())
      if (!next || !hostMatches(next.hostname, allowedHosts)) return null
      current = next
      continue
    }
    return status < 400 ? current : null
  }
  return null
}
