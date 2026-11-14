import { SubtitleData } from '~/lib/types'

export async function getBiliSubtitles(url: string): Promise<SubtitleData[]> {
  try {
    // 凭证由服务端 httpOnly 会话自动携带，前端不再传递 cookie 字段
    const response = await fetch('/api/bilibili/subtitle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
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
