import type { NextApiRequest, NextApiResponse } from 'next'
import { clearBiliSession } from '~/lib/bilibili/session'
import { methodAllowed, rejectMethod } from '~/lib/security/request'

/** 清除服务端 httpOnly 会话 Cookie，前端 clearBiliAuth 会以 fire-and-forget 方式调用 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!methodAllowed(req, ['POST'])) {
    const r = rejectMethod(['POST'])
    return res.status(r.statusCode).json(r.body)
  }
  clearBiliSession(res)
  return res.status(200).json({ status: 'success' })
}
