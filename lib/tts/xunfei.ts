// 讯飞在线语音合成（v2 WebSocket）服务端封装
// 协议：wss://tts-api.xfyun.cn/v2/tts，JSON 帧 + base64 音频，无需二进制协议
import crypto from 'crypto'
import WebSocket from 'ws'

const TTS_HOST = 'tts-api.xfyun.cn'
const TTS_URI = '/v2/tts'

export interface XfyunConfig {
  appId: string
  apiKey: string
  apiSecret: string
}

export function getXfyunConfig(): XfyunConfig | null {
  const appId = process.env.XFYUN_APP_ID
  const apiKey = process.env.XFYUN_API_KEY
  const apiSecret = process.env.XFYUN_API_SECRET
  if (!appId || !apiKey || !apiSecret) return null
  return { appId, apiKey, apiSecret }
}

/** 生成带签名的鉴权 URL（hmac-sha256） */
function buildAuthUrl(apiKey: string, apiSecret: string): string {
  const date = new Date().toUTCString()
  const signatureOrigin = `host: ${TTS_HOST}\ndate: ${date}\nGET ${TTS_URI} HTTP/1.1`
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(signatureOrigin)
    .digest('base64')
  const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authorization = Buffer.from(authorizationOrigin).toString('base64')
  return `wss://${TTS_HOST}${TTS_URI}?authorization=${encodeURIComponent(
    authorization
  )}&date=${encodeURIComponent(date)}&host=${TTS_HOST}`
}

export interface TtsOptions {
  /** 发音人，默认 xiaoyan */
  vcn?: string
  /** 语速 0-100，默认 50 */
  speed?: number
}

/**
 * 合成文本为 MP3 音频。
 * 返回 Buffer（mp3 二进制）。文本需小于 8000 字节（约 2000 汉字）。
 */
export function synthesizeToMp3(
  text: string,
  config: XfyunConfig,
  opts: TtsOptions = {}
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const trimmed = text.trim().slice(0, 1800)
    if (!trimmed) {
      return reject(new Error('TTS 文本为空'))
    }

    const url = buildAuthUrl(config.apiKey, config.apiSecret)
    const ws = new WebSocket(url)

    const chunks: Buffer[] = []
    let settled = false

    const finish = (err: Error | null, result?: Buffer) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        ws.close(1000)
      } catch {
        /* noop */
      }
      if (err) reject(err)
      else resolve(result as Buffer)
    }

    const timer = setTimeout(() => {
      finish(new Error('TTS 请求超时（15s）'))
    }, 15000)

    ws.on('open', () => {
      const frame = {
        common: { app_id: config.appId },
        business: {
          aue: 'lame', // mp3
          sfl: 1,
          vcn: opts.vcn || 'xiaoyan',
          tte: 'UTF8',
          speed: opts.speed ?? 50,
        },
        data: {
          status: 2,
          text: Buffer.from(trimmed, 'utf-8').toString('base64'),
        },
      }
      ws.send(JSON.stringify(frame))
    })

    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        // 默认协议下不应出现二进制帧，忽略
        return
      }
      try {
        const msg = JSON.parse(data.toString())
        if (msg.code !== 0) {
          return finish(
            new Error(`讯飞 TTS 错误 ${msg.code}: ${msg.message || '未知'}`)
          )
        }
        const audio = msg.data?.audio
        if (typeof audio === 'string' && audio.length > 0) {
          chunks.push(Buffer.from(audio, 'base64'))
        }
        if (msg.data?.status === 2) {
          const mp3 = Buffer.concat(chunks)
          if (!mp3.length) {
            return finish(new Error('TTS 未返回音频数据'))
          }
          finish(null, mp3)
        }
      } catch (e) {
        finish(e as Error)
      }
    })

    ws.on('error', (err: Error) => finish(err))
    ws.on('close', () => {
      // 若服务端意外断开且未完成，标记失败
      setTimeout(() => {
        if (!settled) finish(new Error('TTS 连接提前关闭'))
      }, 50)
    })
  })
}
