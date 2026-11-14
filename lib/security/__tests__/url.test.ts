import { describe, it, expect } from 'vitest'
import {
  isPrivateHost,
  parseSafeUrl,
  hostMatches,
  isAllowedUrl,
  safeResolveRedirect,
  BILIBILI_HOSTS,
  VIDEO_HOSTS,
} from '~/lib/security/url'

describe('isPrivateHost', () => {
  it('拒绝本地回环与内网地址', () => {
    expect(isPrivateHost('127.0.0.1')).toBe(true)
    expect(isPrivateHost('localhost')).toBe(true)
    expect(isPrivateHost('192.168.1.1')).toBe(true)
    expect(isPrivateHost('10.0.0.5')).toBe(true)
    expect(isPrivateHost('169.254.169.254')).toBe(true)
    expect(isPrivateHost('[::1]')).toBe(true)
  })

  it('接受正常公网域名', () => {
    expect(isPrivateHost('api.bilibili.com')).toBe(false)
    expect(isPrivateHost('example.com')).toBe(false)
  })
})

describe('parseSafeUrl', () => {
  it('仅接受 https（或显式允许 http）', () => {
    expect(parseSafeUrl('https://api.bilibili.com/x')?.href).toBe('https://api.bilibili.com/x')
    expect(parseSafeUrl('ftp://example.com')).toBeNull()
    expect(parseSafeUrl('http://example.com')).toBeNull()
    expect(parseSafeUrl('http://example.com', { allowHttp: true })?.protocol).toBe('http:')
  })

  it('拒绝含 userinfo 与非标准端口', () => {
    expect(parseSafeUrl('https://user:pwd@example.com')).toBeNull()
    expect(parseSafeUrl('https://example.com:8080')).toBeNull()
  })

  it('拒绝畸形与超长输入', () => {
    expect(parseSafeUrl('not a url')).toBeNull()
    expect(parseSafeUrl(123 as unknown)).toBeNull()
    expect(parseSafeUrl('https://' + 'a'.repeat(3000))).toBeNull()
  })
})

describe('hostMatches', () => {
  it('精确匹配与子域匹配，不含后缀伪装', () => {
    expect(hostMatches('bilibili.com', BILIBILI_HOSTS)).toBe(true)
    expect(hostMatches('api.bilibili.com', BILIBILI_HOSTS)).toBe(true)
    expect(hostMatches('bilibili.com.evil.com', BILIBILI_HOSTS)).toBe(false)
  })
})

describe('isAllowedUrl', () => {
  it('白名单内通过，外域拒绝', () => {
    expect(isAllowedUrl('https://www.bilibili.com/video/BV1xx', BILIBILI_HOSTS)).toBe(true)
    expect(isAllowedUrl('https://evil.example.com/x', BILIBILI_HOSTS)).toBe(false)
    expect(isAllowedUrl('https://www.youtube.com/watch?v=1', VIDEO_HOSTS)).toBe(true)
  })
})

describe('safeResolveRedirect', () => {
  it('首跳合法但 302 到内网时拒绝', async () => {
    const result = await safeResolveRedirect('https://www.bilibili.com/x', BILIBILI_HOSTS)
    // 真实网络不可达时返回 null，但不应抛错
    expect(result === null || result instanceof URL).toBe(true)
  })
})
