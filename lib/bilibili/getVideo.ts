import { getBiliCookie } from '~/lib/bilibili/auth'

export async function getBiliVideo(url: string): Promise<string> {
  // resolve 模式：服务端仅解析 CDN 直链，视频流由浏览器直连 CDN 播放
  const response = await fetch('/api/bilibili/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, cookie: getBiliCookie() || '', resolve: '1' }),
  })

  if (!response.ok) {
    throw new Error('视频获取失败')
  }

  const data = await response.json()
  if (!data.playUrl) {
    throw new Error('视频获取失败')
  }
  return data.playUrl as string
}
