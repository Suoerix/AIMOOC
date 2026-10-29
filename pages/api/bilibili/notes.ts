import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL, OPENAI_MAX_TOKENS } from '~/lib/openai'
import { NOTES_SYSTEM_PROMPT, subtitlesToText } from '~/lib/ai/prompts'
import { fetchSubtitles } from '~/lib/bilibili/server'

export const maxDuration = 60

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url, cookie } = req.body || {}

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing url parameter' })
  }

  try {
    const subtitles = await fetchSubtitles(url, cookie)
    if (!subtitles.length) {
      return res.status(501).json({ error: 'No subtitles found' })
    }

    const transcript = subtitlesToText(subtitles, true)
    const client = getOpenAIClient()
    const completion = await withRetry(() =>
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: NOTES_SYSTEM_PROMPT },
          { role: 'user', content: `视频字幕如下：\n\n${transcript}` },
        ],
        temperature: 0.3,
        max_tokens: OPENAI_MAX_TOKENS,
      })
    )

    const notes = completion.choices[0]?.message?.content || ''
    res.status(200).json({ notes })
  } catch (error: any) {
    console.error('Error generating notes:', error)
    const status = error?.status || 500
    res.status(status).json({
      error:
        status === 429
          ? 'AI 服务请求频率/配额超限（429），请稍后重试或检查 API key 配额'
          : `AI 服务错误（${status}）: ${error?.message || 'Failed to generate notes'}`,
    })
  }
}
