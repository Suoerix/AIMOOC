/**
 * 多平台视频适配层统一入口：平台识别、解析调度、能力总览。
 *
 * 顶层刻意不静态 import 任何 provider：provider 会传递依赖 lib/bilibili/server.ts
 * （内部 require('undici')），若随本模块进入客户端页面包会带来打包负担。
 * 解析逻辑改为在 resolveVideo 内按需动态加载；功能总览页只用到纯数据 SUPPORTED_PLATFORMS。
 */

import { BILIBILI_HOSTS, VIDEO_HOSTS, hostMatches, parseSafeUrl } from '~/lib/security/url'
import { logInternalError } from '~/lib/security/request'
import { DIRECT_MEDIA_RE, GENERIC_HOSTS, VIMEO_HOSTS, YOUTUBE_HOSTS } from '~/lib/video/types'
import type { ResolvedVideo, ResolveOptions, VideoMeta, VideoProvider } from '~/lib/video/types'

// 纯数据能力总览：同时从本模块导出，满足对外契约
export { SUPPORTED_PLATFORMS } from '~/lib/video/types'

const UNKNOWN_NOTICE = '无法识别该视频链接，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'
const FALLBACK_NOTICE = '视频信息自动解析未完成，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'

/**
 * 识别输入链接归属的平台。
 * 直链优先于平台 CDN 判定；白名单内的其它站点统一归入通用平台手动通道。
 */
export function detectProvider(rawUrl: string): VideoProvider | null {
  const u = parseSafeUrl(rawUrl, { allowHttp: true })
  if (!u) return null
  const host = u.hostname.toLowerCase()

  if (DIRECT_MEDIA_RE.test(u.pathname)) return 'direct'
  if (hostMatches(host, BILIBILI_HOSTS)) return 'bilibili'
  if (hostMatches(host, YOUTUBE_HOSTS)) return 'youtube'
  if (hostMatches(host, VIMEO_HOSTS)) return 'vimeo'
  if (hostMatches(host, GENERIC_HOSTS)) return 'generic'
  // 白名单内的其它 CDN / 海外站点（如 bilibili.tv、vimeocdn.com）走手动通道兜底
  if (hostMatches(host, VIDEO_HOSTS)) return 'generic'
  return null
}

/** 按需加载对应平台实现，避免在客户端页面包里静态携带服务端 provider */
async function dispatch(provider: VideoProvider, rawUrl: string, options: ResolveOptions): Promise<ResolvedVideo> {
  switch (provider) {
    case 'bilibili': {
      const mod = await import('~/lib/video/providers/bilibili')
      return mod.resolveBilibili(rawUrl, options)
    }
    case 'youtube': {
      const mod = await import('~/lib/video/providers/youtube')
      return mod.resolveYoutube(rawUrl, options)
    }
    case 'vimeo': {
      const mod = await import('~/lib/video/providers/vimeo')
      return mod.resolveVimeo(rawUrl, options)
    }
    case 'direct': {
      const mod = await import('~/lib/video/providers/direct')
      return mod.resolveDirect(rawUrl, options)
    }
    case 'generic':
    default: {
      const mod = await import('~/lib/video/providers/generic')
      return mod.resolveGeneric(rawUrl, options)
    }
  }
}

function fallbackMeta(rawUrl: string, provider: VideoProvider): VideoMeta {
  return {
    provider,
    id: '',
    title: '未命名视频',
    sourceUrl: rawUrl,
    transcriptMode: 'manual',
  }
}

function manualResult(rawUrl: string, provider: VideoProvider, notice: string): ResolvedVideo {
  return {
    meta: fallbackMeta(rawUrl, provider),
    transcript: [],
    transcriptSource: 'none',
    needsManualTranscript: true,
    notice,
  }
}

/**
 * 解析视频链接为统一的 ResolvedVideo。
 * 任何异常都不向外抛出，一律返回带 needsManualTranscript:true 与中文提示的结果。
 */
export async function resolveVideo(rawUrl: string, options: ResolveOptions = {}): Promise<ResolvedVideo> {
  const provider = detectProvider(rawUrl)
  if (!provider) {
    return manualResult(rawUrl, 'generic', UNKNOWN_NOTICE)
  }

  try {
    const resolved = await dispatch(provider, rawUrl, options)
    const transcript = Array.isArray(resolved.transcript) ? resolved.transcript : []
    const hasTranscript = transcript.length > 0
    const meta: VideoMeta = {
      ...resolved.meta,
      provider,
      sourceUrl: rawUrl,
    }
    return {
      meta,
      transcript,
      transcriptSource: hasTranscript ? resolved.transcriptSource : 'none',
      needsManualTranscript: !hasTranscript || resolved.needsManualTranscript,
      notice: hasTranscript ? resolved.notice : resolved.notice || FALLBACK_NOTICE,
    }
  } catch (error) {
    logInternalError('video/' + provider, error)
    return manualResult(rawUrl, provider, FALLBACK_NOTICE)
  }
}
