import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL, OPENAI_MAX_TOKENS } from '~/lib/openai'
import {
  CHAT_SYSTEM_PROMPT,
  ROUTER_SYSTEM_PROMPT,
  buildTeachingAssistantPrompt,
} from '~/lib/ai/prompts'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * POST { messages, mode?, videoTitle?, outline? }
 * mode: 'router'（主页接待） | 'ta'（教室助教，带课程上下文） | 默认通用助教
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages, mode, videoTitle, outline } = (req.body || {}) as {
    messages?: ChatMessage[]
    mode?: 'router' | 'ta'
    videoTitle?: string
    outline?: string
  }
  if (!messages?.length) {
    return res.status(400).json({ error: 'Missing messages' })
  }

  let systemPrompt = CHAT_SYSTEM_PROMPT
  if (mode === 'router') systemPrompt = ROUTER_SYSTEM_PROMPT
  else if (mode === 'ta') systemPrompt = buildTeachingAssistantPrompt(videoTitle, outline)

  try {
    const client = getOpenAIClient()
    const stream = await withRetry(() =>
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: mode === 'router' ? 300 : OPENAI_MAX_TOKENS,
        temperature: mode === 'router' ? 0.6 : 0.7,
        stream: true,
      })
    )

    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache')
    res.status(200)

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        res.write(content)
      }
    }
    res.end()
  } catch (error: any) {
    console.error('Error in chat:', error)
    const status = error?.status || 500
    const message = error?.message || 'Chat failed'
    if (!res.headersSent) {
      res.status(status).json({ error: `AI 服务错误（${status}）: ${message}` })
    } else {
      res.end()
    }
  }
}
