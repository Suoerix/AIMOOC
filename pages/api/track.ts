import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { getServiceClient } from '~/lib/supabase/server'
import { isSupabaseConfigured } from '~/lib/supabase/client'
import { validateTrackEvent } from '~/lib/security/input'
import { methodAllowed, rejectMethod, isBodyTooLarge, logInternalError, publicError } from '~/lib/security/request'

export const maxDuration = 30

/**
 * POST → 学习埋点。
 * 未配置 Supabase 时直接 204（客户端仍会写入本地历史）。
 * 配置后：必须 getUser() 验签；匿名一律不写库直接 204；字段全部经
 * validateTrackEvent 校验；service role 写入时身份取自已验签的 user。
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const rejected = rejectMethod(['POST'])
    return res.status(rejected.statusCode).json(rejected.body)
  }

  // 无云端数据源：本地统计仍可用，无需写库
  if (!isSupabaseConfigured()) {
    return res.status(204).end()
  }

  // 粗略阻挡超大 payload，避免任意长文本打进数据库
  if (isBodyTooLarge(req.body)) {
    return res.status(413).json({ errorMessage: '请求体过大' })
  }

  // 身份必须来自验签后的 getUser()；匿名上报一律不写库
  let user: { id: string; email?: string | null } | null = null
  try {
    const supabase = createServerSupabaseClient({ req, res })
    const {
      data: { user: verified },
      error,
    } = await supabase.auth.getUser()
    if (error) logInternalError('track.getUser', error)
    if (verified?.id) {
      user = { id: verified.id, email: verified.email }
    }
  } catch (error) {
    logInternalError('track.auth', error)
  }
  if (!user) {
    return res.status(204).end()
  }

  // 所有入库字段统一走白名单校验，避免灌入任意长文本 / 伪造字段
  const parsed = validateTrackEvent(req.body)
  if (!parsed.ok) {
    return res.status(400).json({ errorMessage: parsed.error })
  }
  if (!parsed.value.videoId) {
    return res.status(400).json({ errorMessage: '缺少课程标识' })
  }

  const service = getServiceClient()
  if (!service) {
    return res.status(204).end()
  }

  try {
    const { error } = await service.from('study_events').insert({
      user_id: user.id,
      email: user.email ?? null,
      video_id: parsed.value.videoId,
      title: parsed.value.title,
      subject: parsed.value.subject || null,
      kind: parsed.value.kind,
      duration_sec: parsed.value.durationSec,
    })
    if (error) {
      logInternalError('track.insert', error)
      return res.status(500).json({ errorMessage: publicError() })
    }
  } catch (error) {
    logInternalError('track.insert', error)
    return res.status(500).json({ errorMessage: publicError() })
  }

  return res.status(200).json({ ok: true })
}
