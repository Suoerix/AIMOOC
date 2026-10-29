import type { NextApiRequest, NextApiResponse } from 'next'
import { getOpenAIClient, withRetry, OPENAI_MODEL } from '~/lib/openai'
import { CHAT_SYSTEM_PROMPT } from '~/lib/ai/prompts'

export const maxDuration = 60

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { messages } = (req.body || {}) as { messages?: ChatMessage[] }
  if (!messages?.length) {
    return res.status(400).json({ error: 'Missing messages' })
  }

  try {
    const client = getOpenAIClient()
    const stream = await withRetry(() =>
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
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
