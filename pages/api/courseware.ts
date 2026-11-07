import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL, OPENAI_MAX_TOKENS } from '~/lib/openai'
import { COURSEWARE_SYSTEM_PROMPT, subtitlesToText } from '~/lib/ai/prompts'
import { fetchSubtitles } from '~/lib/bilibili/server'

export const maxDuration = 60

/**
 * POST { videoId, pageNumber?, cookie? } → 流式纯文本课件（#S/#T 行协议）
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const { videoId, pageNumber, cookie, videoTitle } = (req.body || {}) as {
    videoId?: string
    pageNumber?: string | number
    cookie?: string
    videoTitle?: string
  }
  if (!videoId) {
    return res.status(400).json({ errorMessage: 'Missing videoId' })
  }

  let transcript: string
  try {
    const url = `https://www.bilibili.com/video/${videoId}${
      pageNumber ? `?p=${pageNumber}` : ''
    }`
    const subtitles = await fetchSubtitles(url, cookie)
    if (!subtitles.length) {
      return res.status(501).json({ errorMessage: '该视频没有可用字幕，无法生成 AI 课件' })
    }
    transcript = subtitlesToText(subtitles, true)
    // 标题由前端从 /api/bilibili/info 获取，这里不做二次请求
  } catch (error) {
    console.error('Error fetching subtitles for courseware:', error)
    return res.status(501).json({ errorMessage: '该视频没有可用字幕，无法生成 AI 课件' })
  }

  try {
    const client = getOpenAIClient()
    const stream = await withRetry(() =>
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: COURSEWARE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `视频标题：${videoTitle || '（未知）'}\n\n视频字幕如下（含时间戳，单位秒）：\n\n${transcript}`,
          },
        ],
        temperature: 0.3,
        max_tokens: OPENAI_MAX_TOKENS,
        stream: true,
      })
    )

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')
    res.status(200)

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) res.write(content)
    }
    res.end()
  } catch (error: any) {
    console.error('Error generating courseware:', error)
    const status = error?.status || 500
    const message = error?.message || 'Courseware generation failed'
    if (!res.headersSent) {
      res.status(status).json({ errorMessage: `AI 服务错误（${status}）: ${message}` })
    } else {
      res.end()
    }
  }
}
