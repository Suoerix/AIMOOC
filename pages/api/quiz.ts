import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL } from '~/lib/openai'
import { QUIZ_SYSTEM_PROMPT, subtitlesToText } from '~/lib/ai/prompts'
import { fetchSubtitles } from '~/lib/bilibili/server'

export const maxDuration = 60

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation: string
  time: number
}

/**
 * POST { videoId, pageNumber?, cookie?, count? } → { questions: QuizQuestion[] }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const { videoId, pageNumber, cookie } = (req.body || {}) as {
    videoId?: string
    pageNumber?: string | number
    cookie?: string
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
    transcript = subtitlesToText(subtitles, true).slice(0, 24000)
  } catch (error) {
    console.error('Error fetching subtitles for quiz:', error)
    return res.status(501).json({ errorMessage: '该视频没有可用字幕，无法生成教学内容' })
  }

  try {
    const client = getOpenAIClient()
    const baseParams = {
      model: OPENAI_MODEL,
      messages: [
        { role: 'system' as const, content: QUIZ_SYSTEM_PROMPT },
        {
          role: 'user' as const,
          content: `视频字幕如下（含时间戳，单位秒）：\n\n${transcript}`,
        },
      ],
      temperature: 0.4,
      max_tokens: 2048,
    }

    // 优先用 JSON 模式；部分第三方兼容接口不支持 response_format，回退普通模式
    let completion
    try {
      completion = await withRetry(() =>
        client.chat.completions.create({
          ...baseParams,
          response_format: { type: 'json_object' as any },
        })
      )
    } catch (e: any) {
      if (e?.status !== 400) throw e
      completion = await withRetry(() => client.chat.completions.create(baseParams))
    }

    const raw = completion.choices[0]?.message?.content || ''
    let parsed: { questions?: QuizQuestion[] }
    try {
      parsed = JSON.parse(raw)
    } catch {
      // 尝试从可能的 Markdown 包裹中提取
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('出题结果解析失败')
      parsed = JSON.parse(match[0])
    }

    const questions = (parsed.questions || [])
      .filter(
        (q: QuizQuestion) =>
          q &&
          typeof q.question === 'string' &&
          Array.isArray(q.options) &&
          q.options.length >= 2
      )
      .map((q: QuizQuestion) => ({
        ...q,
        answer: Math.max(0, Math.min(q.answer ?? 0, q.options.length - 1)),
        time: Number(q.time) || 0,
      }))

    if (!questions.length) {
      return res.status(502).json({ errorMessage: '未能生成有效题目' })
    }

    return res.status(200).json({ questions })
  } catch (error: any) {
    console.error('Error generating quiz:', error)
    const status = error?.status || 500
    return res
      .status(status)
      .json({ errorMessage: `AI 服务错误（${status}）: ${error?.message || 'Quiz failed'}` })
  }
}
