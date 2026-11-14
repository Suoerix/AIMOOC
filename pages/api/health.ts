import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * 部署探针：供平台健康检查与监控告警使用。
 * 不读取任何密钥，不依赖外部服务，永远返回 200。
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'ok',
    service: 'aimooc',
    time: new Date().toISOString(),
  })
}
