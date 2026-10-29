import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL, OPENAI_MAX_TOKENS } from '~/lib/openai'
import { buildSummarizePrompt, subtitlesToText } from '~/lib/ai/prompts'
import { getCache, setCache } from '~/lib/cache'
import { fetchSubtitles } from '~/lib/bilibili/server'
import { SummarizeParams } from '~/lib/types'
import { getCacheId } from '~/utils/getCacheId'

export const maxDuration = 60

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const { videoConfig, userConfig, cookie } = (req.body || {}) as SummarizeParams & {
    cookie?: string
  }
  if (!videoConfig?.videoId) {
    return res.status(400).json({ errorMessage: 'Missing videoConfig' })
  }

  const cacheId = getCacheId(videoConfig)
  const cached = await getCache<string>(cacheId)
  if (cached) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    return res.status(200).end(cached)
  }

  let transcript: string
  try {
    const url = `https://www.bilibili.com/video/${videoConfig.videoId}${
      videoConfig.pageNumber ? `?p=${videoConfig.pageNumber}` : ''
    }`
    const subtitles = await fetchSubtitles(url, cookie)
    if (!subtitles.length) {
      return res.status(501).json({ errorMessage: 'No subtitles found' })
    }
    transcript = subtitlesToText(subtitles, videoConfig.showTimestamp !== false)
  } catch (error) {
    console.error('Error fetching subtitles for sumup:', error)
    return res.status(501).json({ errorMessage: 'No subtitles found' })
  }

  try {
    const client = getOpenAIClient()
    const stream = await withRetry(() =>
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: buildSummarizePrompt(videoConfig) },
          { role: 'user', content: `视频字幕如下：\n\n${transcript}` },
        ],
        temperature: 0.4,
        max_tokens: OPENAI_MAX_TOKENS,
        stream: true,
      })
    )

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('X-Accel-Buffering', 'no')
    res.status(200)

    let fullText = ''
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullText += content
        res.write(content)
      }
    }
    res.end()

    if (fullText) {
      await setCache(cacheId, fullText)
    }
  } catch (error: any) {
    console.error('Error summarizing:', error)
    const status = error?.status || 500
    const message =
      status === 429
        ? 'AI 服务请求频率/配额超限（429），请稍后重试或检查 API key 配额'
        : error?.message || 'Summarize failed'
    if (!res.headersSent) {
      res.status(status).json({ errorMessage: `AI 服务错误（${status}）: ${message}` })
    } else {
      res.end()
    }
  }
}
