import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { clientIpKey, fnv1a, methodAllowed, rejectMethod, isBodyTooLarge, bodySizeChars } from '~/lib/security/request'

function fakeReq(headers: Record<string, string>) {
  return { headers } as unknown as NextRequest
}

describe('fnv1a', () => {
  it('确定性且非空', () => {
    expect(fnv1a('127.0.0.1')).toBe(fnv1a('127.0.0.1'))
    expect(fnv1a('a')).not.toBe(fnv1a('b'))
  })
})

describe('clientIpKey', () => {
  it('优先取 x-real-ip，回退 x-forwarded-for 末跳', () => {
    const byReal = clientIpKey(fakeReq({ 'x-real-ip': '1.2.3.4' }))
    expect(byReal).toBe(`ip:${fnv1a('1.2.3.4')}`)
    const byFwd = clientIpKey(fakeReq({ 'x-forwarded-for': '9.9.9.9, 1.2.3.4' }))
    expect(byFwd).toBe(`ip:${fnv1a('1.2.3.4')}`)
  })

  it('不直接暴露原始 IP 明文', () => {
    const key = clientIpKey(fakeReq({ 'x-real-ip': '203.0.113.7' }))
    expect(key).not.toContain('203.0.113.7')
  })
})

describe('methodAllowed / rejectMethod', () => {
  it('方法校验与 405 响应', () => {
    expect(methodAllowed({ method: 'POST' } as any, ['POST'])).toBe(true)
    expect(methodAllowed({ method: 'GET' } as any, ['POST'])).toBe(false)
    const r = rejectMethod(['POST'])
    expect(r.statusCode).toBe(405)
  })
})

describe('body size guards', () => {
  it('估算并记录超大 body', () => {
    expect(bodySizeChars('hello')).toBe(5)
    expect(isBodyTooLarge('x'.repeat(200_000))).toBe(true)
    expect(isBodyTooLarge({ a: 'x'.repeat(10) })).toBe(false)
  })
})
