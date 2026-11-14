/**
 * 多平台视频适配层的公共契约类型，以及一处集中复用的带白名单 / 超时的外联工具。
 *
 * 说明：受本次改动允许新建的文件清单限制，把无第三方依赖、且不与具体平台实现
 * 产生循环引用的 safeVideoFetch 一并放在此处，供各 provider 与 API 路由共用。
 * 组件与工具模块只通过 import type 引用本文件的类型，不会把外联逻辑打进浏览器包。
 */

import { isAllowedUrl, parseSafeUrl } from '~/lib/security/url'

// ===== 对外契约类型（其它并行模块据此 import，签名不可变）=====

export type VideoProvider = 'bilibili' | 'youtube' | 'vimeo' | 'direct' | 'generic'

export interface VideoMeta {
  provider: VideoProvider
  id: string
  title: string
  author?: string
  durationSec?: number
  thumbnail?: string
  embedUrl?: string
  playUrl?: string
  sourceUrl: string
  transcriptMode: 'auto' | 'manual' | 'text'
}

export interface TranscriptItem {
  from: number
  to: number
  content: string
}

export interface ResolvedVideo {
  meta: VideoMeta
  transcript: TranscriptItem[]
  transcriptSource: string
  needsManualTranscript: boolean
  notice?: string
}

// ===== 适配层内部复用类型 =====

export interface ResolveOptions {
  cookie?: string
}

/** /features 功能总览页展示用的平台能力说明 */
export interface SupportedPlatform {
  name: string
  hosts: string[]
  mode: 'auto' | 'manual'
  note: string
}

// ===== 平台常量（单一来源，供识别、外联白名单与能力总览共用）=====

export const YOUTUBE_HOSTS = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'googlevideo.com']

export const VIMEO_HOSTS = ['vimeo.com', 'player.vimeo.com', 'vimeocdn.com']

export const GENERIC_HOSTS = ['douyin.com', 'iesdouyin.com', 'ixigua.com', 'v.qq.com', 'youku.com', 'iqiyi.com']

/** 直链媒体文件扩展名，匹配 URL 的 pathname 末尾 */
export const DIRECT_MEDIA_RE = /\.(mp4|webm|ogg|m3u8)$/i

/** 契约指定的通用平台提示语 */
export const GENERIC_MANUAL_NOTICE =
  '该平台没有公开字幕接口，请粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'

/**
 * 各平台能力总览，供功能介绍页展示。
 * 纯数据、不依赖任何平台实现，可安全地在客户端页面直接引用。
 */
export const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  {
    name: '哔哩哔哩',
    hosts: ['bilibili.com', 'b23.tv', 'bilibili.tv'],
    mode: 'auto',
    note: '可自动获取视频字幕与元数据，登录后支持更多受限字幕。',
  },
  {
    name: 'YouTube',
    hosts: YOUTUBE_HOSTS,
    mode: 'manual',
    note: '自动获取标题与作者，并尽力抓取公开字幕；失败时请手动粘贴或上传字幕文件。',
  },
  {
    name: 'Vimeo',
    hosts: VIMEO_HOSTS,
    mode: 'manual',
    note: '自动获取标题、作者与时长，字幕需手动粘贴或上传字幕文件。',
  },
  {
    name: '直链视频',
    hosts: [],
    mode: 'manual',
    note: '支持 mp4 / webm / ogg / m3u8 直链播放，字幕需手动提供。',
  },
  {
    name: '抖音',
    hosts: ['douyin.com', 'iesdouyin.com'],
    mode: 'manual',
    note: '识别视频链接与常用短链，字幕需手动粘贴或上传字幕文件。',
  },
  {
    name: '西瓜视频',
    hosts: ['ixigua.com'],
    mode: 'manual',
    note: '识别视频链接，字幕需手动粘贴或上传字幕文件。',
  },
  {
    name: '腾讯视频',
    hosts: ['v.qq.com'],
    mode: 'manual',
    note: '识别视频链接并提供官方播放器，字幕需手动粘贴或上传字幕文件。',
  },
  {
    name: '优酷',
    hosts: ['youku.com'],
    mode: 'manual',
    note: '识别视频链接并提供官方播放器，字幕需手动粘贴或上传字幕文件。',
  },
  {
    name: '爱奇艺',
    hosts: ['iqiyi.com'],
    mode: 'manual',
    note: '识别视频链接，字幕需手动粘贴或上传字幕文件。',
  },
]

// ===== 外联工具 =====

/** 单次外联请求的最长等待时间（毫秒） */
export const VIDEO_FETCH_TIMEOUT_MS = 8000

/**
 * 所有第三方 fetch 的统一入口：
 * 1. 先用 isAllowedUrl / parseSafeUrl 做域名白名单与基础安全校验；
 * 2. 再用 AbortController + setTimeout 限定时长（不使用 AbortSignal.timeout，兼容旧运行时）；
 * 3. 自动跟随重定向后，对最终地址再做一次白名单校验。
 * 校验失败或超时均抛出异常，由调用方决定降级策略。
 */
export async function safeVideoFetch(
  rawUrl: string,
  allowedHosts: readonly string[],
  init: RequestInit = {},
): Promise<Response> {
  if (!isAllowedUrl(rawUrl, allowedHosts)) {
    throw new Error('外联地址未通过域名白名单校验')
  }
  const safeUrl = parseSafeUrl(rawUrl)
  if (!safeUrl) {
    throw new Error('外联地址不合法')
  }

  const controller = new AbortController()
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => controller.abort(), VIDEO_FETCH_TIMEOUT_MS)
  try {
    const headers = new Headers(init.headers)
    if (!headers.has('User-Agent')) {
      headers.set('User-Agent', 'Mozilla/5.0 (compatible; AIMOOC/2.0)')
    }
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json, text/plain, application/xml, */*')
    }
    const response = await fetch(safeUrl.toString(), {
      ...init,
      headers,
      signal: controller.signal,
      redirect: 'follow',
    })
    // 跟随重定向后再次确认最终地址仍在白名单，避免开放重定向造成越界访问
    if (response.url && !isAllowedUrl(response.url, allowedHosts)) {
      throw new Error('重定向后的地址不在白名单内')
    }
    return response
  } finally {
    clearTimeout(timer)
  }
}
