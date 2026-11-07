import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL, OPENAI_MAX_TOKENS } from '~/lib/openai'
import { VISUALIZE_SYSTEM_PROMPT, subtitlesToText } from '~/lib/ai/prompts'
import { fetchSubtitles } from '~/lib/bilibili/server'

export const maxDuration = 60

/**
 * POST { videoId, pageNumber?, cookie?, topic? } → 流式输出自包含交互 HTML
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const { videoId, pageNumber, cookie, topic } = (req.body || {}) as {
    videoId?: string
    pageNumber?: string | number
    cookie?: string
    topic?: string
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
      return res.status(501).json({ errorMessage: '该视频没有可用字幕，无法生成教学内容' })
    }
    // 可视化不需要时间戳，压缩上下文
    transcript = subtitlesToText(subtitles, false).slice(0, 24000)
  } catch (error) {
    console.error('Error fetching subtitles for visualize:', error)
    return res.status(501).json({ errorMessage: '该视频没有可用字幕，无法生成教学内容' })
  }

  try {
    const client = getOpenAIClient()
    const stream = await withRetry(() =>
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: VISUALIZE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `${
              topic ? `用户希望可视化实验围绕这个知识点：${topic}\n\n` : ''
            }视频字幕如下：\n\n${transcript}`,
          },
        ],
        temperature: 0.5,
        max_tokens: Math.max(OPENAI_MAX_TOKENS, 8192),
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
    console.error('Error generating visualization:', error)
    const status = error?.status || 500
    const message = error?.message || 'Visualization generation failed'
    if (!res.headersSent) {
      res.status(status).json({ errorMessage: `AI 服务错误（${status}）: ${message}` })
    } else {
      res.end()
    }
  }
}
