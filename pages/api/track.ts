import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { getServiceClient } from '~/lib/supabase/server'

export const maxDuration = 30

/**
 * POST { videoId, title, subject, durationSec, kind } → 学习埋点
 * 未配置 Supabase 时直接 204（客户端仍会写入本地历史）。
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ errorMessage: 'Method not allowed' })
  }

  const { videoId, title, subject, durationSec, kind } = (req.body || {}) as {
    videoId?: string
    title?: string
    subject?: string
    durationSec?: number
    kind?: string
  }

  if (!videoId) {
    return res.status(400).json({ errorMessage: 'Missing videoId' })
  }

  const service = getServiceClient()
  if (!service) {
    // 无云端数据源：本地统计仍可用
    return res.status(204).end()
  }

  let userId: string | null = null
  let email: string | null = null
  try {
    const supabase = createServerSupabaseClient({ req, res })
    const {
      data: { session },
    } = await supabase.auth.getSession()
    userId = session?.user?.id ?? null
    email = session?.user?.email ?? null
  } catch {
    /* 匿名上报 */
  }

  try {
    await service.from('study_events').insert({
      user_id: userId,
      email,
      video_id: videoId,
      title: title || '',
      subject: subject || null,
      kind: kind || 'session',
      duration_sec: Math.max(0, Math.round(Number(durationSec) || 0)),
    })
  } catch (error) {
    console.error('track error:', error)
  }

  return res.status(200).json({ ok: true })
}
