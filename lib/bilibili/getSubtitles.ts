import { SubtitleData } from '~/lib/types'
import { getBiliCookie } from '~/lib/bilibili/auth'

export async function getBiliSubtitles(url: string): Promise<SubtitleData[]> {
  try {
    const response = await fetch('/api/bilibili/subtitle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        cookie: getBiliCookie() || ''
      })
    })

    if (!response.ok) {
      throw new Error('字幕获取失败')
    }

    return await response.json()
  } catch (error) {
    console.error('获取字幕失败:', error)
    throw error
  }
}
