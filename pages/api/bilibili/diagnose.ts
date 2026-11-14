import type { NextApiRequest, NextApiResponse } from 'next'
import { biliHeaders, biliFetchRaw } from '~/lib/bilibili/server'
import { methodAllowed, rejectMethod, logInternalError, publicError } from '~/lib/security/request'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['GET'])) {
    const r = rejectMethod(['GET'])
    return res.status(r.statusCode).json(r.body)
  }

  // 生产环境默认关闭，需显式设置 AIMOOC_ALLOW_DIAGNOSE=1 才开放
  if (process.env.NODE_ENV === 'production' && process.env.AIMOOC_ALLOW_DIAGNOSE !== '1') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  try {
    const response = await biliFetchRaw(
      'https://api.bilibili.com/x/web-interface/view?bvid=BV1GJ411x7h7',
      biliHeaders(),
      { withBuvid: true },
    )
    // 仅返回连通性状态。不回显上游响应片段、error.cause、代理配置、区域信息。
    // 旧实现 buvidAttached = !!req.headers.cookie || true 恒为 true 且无诊断价值，已移除。
    return res.status(200).json({ ok: response.ok, upstreamStatus: response.status })
  } catch (error) {
    logInternalError('bilibili/diagnose', error)
    return res.status(500).json({ error: publicError() })
  }
}
