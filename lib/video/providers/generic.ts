/**
 * 通用平台适配：抖音、西瓜视频、腾讯视频、优酷、爱奇艺及常见短链。
 * 这些平台没有公开字幕接口，仅识别 host 返回 meta，字幕走手动通道。
 * 本模块不发起任何外联请求。
 */

import { hostMatches, parseSafeUrl } from '~/lib/security/url'
import { GENERIC_MANUAL_NOTICE } from '~/lib/video/types'
import type { ResolvedVideo, ResolveOptions } from '~/lib/video/types'

interface PlatformDef {
  name: string
  hosts: string[]
  /** 官方 iframe 播放页模板；无免鉴权播放页的平台留空 */
  embed?: (id: string) => string
}

/**
 * 仅对存在稳定官方 iframe 播放页的平台给出 embedUrl。
 * 参数为分享链接里尽力提取出的视频片段，平台若调整参数前端需容错。
 */
const PLATFORMS: PlatformDef[] = [
  {
    name: '抖音',
    hosts: ['douyin.com', 'iesdouyin.com'],
    embed: (id) => 'https://open.douyin.com/player/video?vid=' + encodeURIComponent(id) + '&autoplay=0',
  },
  {
    name: '西瓜视频',
    hosts: ['ixigua.com'],
    embed: (id) => 'https://www.ixigua.com/iframe/' + encodeURIComponent(id),
  },
  {
    name: '腾讯视频',
    hosts: ['v.qq.com'],
    embed: (id) => 'https://v.qq.com/txp/iframe/player.html?vid=' + encodeURIComponent(id),
  },
  {
    name: '优酷',
    hosts: ['youku.com'],
    embed: (id) => 'https://player.youku.com/embed/' + encodeURIComponent(id),
  },
  // 爱奇艺官方播放器需 vid + tvId 等鉴权参数，链接里无法可靠提取，故不提供 embedUrl
  { name: '爱奇艺', hosts: ['iqiyi.com'] },
]

/** 从查询参数或路径末段提取可读的视频片段标识 */
function extractSegment(u: URL): string {
  const fromQuery = u.searchParams.get('vid') || u.searchParams.get('id') || u.searchParams.get('tvid')
  if (fromQuery) return fromQuery.slice(0, 64)
  const seg = u.pathname.split('/').filter(Boolean)
  const last = seg[seg.length - 1] || u.hostname
  const youku = last.match(/id_([A-Za-z0-9=]+)/)
  if (youku) return youku[1].slice(0, 64)
  return last.replace(/\.(html?|shtml)$/i, '').slice(0, 64)
}

export async function resolveGeneric(rawUrl: string, _options: ResolveOptions): Promise<ResolvedVideo> {
  const u = parseSafeUrl(rawUrl, { allowHttp: true })
  const host = u ? u.hostname.toLowerCase() : ''
  const platform = PLATFORMS.find((p) => hostMatches(host, p.hosts))
  const name = platform ? platform.name : '视频平台'
  const segment = u ? extractSegment(u) : ''
  const title = segment ? name + ' · ' + segment : name
  const embedUrl = platform && platform.embed && segment ? platform.embed(segment) : undefined

  return {
    meta: {
      provider: 'generic',
      id: segment || host || rawUrl,
      title,
      embedUrl,
      sourceUrl: rawUrl,
      transcriptMode: 'manual',
    },
    transcript: [],
    transcriptSource: 'none',
    needsManualTranscript: true,
    notice: GENERIC_MANUAL_NOTICE,
  }
}
