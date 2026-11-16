/**
 * POST { url?, urls? } -> CourseResolveResult
 * 课程解析入口：把「合集链接」或「多个视频链接」编排成有序课程。
 * 安全校验与 /api/video/resolve 同源：方法 / 长度 / 内网 / 域名白名单。
 */
import type { NextApiRequest, NextApiResponse } from 'next'
import { LIMITS } from '~/lib/security/input'
import {
  isBodyTooLarge,
  logInternalError,
  methodAllowed,
  publicError,
  rejectMethod,
} from '~/lib/security/request'
import { isAllowedUrl, parseSafeUrl, VIDEO_HOSTS } from '~/lib/security/url'
import { detectProvider } from '~/lib/video'
import { detectPlaylist, fetchPlaylistEpisodes, buildCourseFromUrls, PlaylistFetchError } from '~/lib/course/playlist'
import { courseIdFromSource } from '~/lib/course/types'
import type { Course, CourseResolveResult, CourseSourceType } from '~/lib/course/types'

export const maxDuration = 30

function validVideoUrl(raw: string): string | null {
  const url = raw.trim()
  if (!url || url.length > LIMITS.urlChars) return null
  if (!parseSafeUrl(url, { allowHttp: true })) return null
  if (!detectProvider(url)) return null
  if (!isAllowedUrl(url, VIDEO_HOSTS)) return null
  return url
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CourseResolveResult>) {
  if (!methodAllowed(req, ['POST'])) {
    const rejected = rejectMethod(['POST'])
    return res.status(rejected.statusCode).json({ ok: false, reason: 'invalid-input', message: rejected.body.errorMessage })
  }

  try {
    if (isBodyTooLarge(req.body)) {
      return res.status(413).json({ ok: false, reason: 'invalid-input', message: '请求体过大' })
    }
    const body = (req.body || {}) as { url?: unknown; urls?: unknown }
    const urlsArr = Array.isArray(body.urls)
      ? (body.urls as unknown[]).map((u) => (typeof u === 'string' ? validVideoUrl(u) : null)).filter((u): u is string => !!u)
      : []

    // 模式一：手动多链接
    if (urlsArr.length > 0) {
      const course = buildCourseFromUrls(urlsArr, 'manual')
      if (!course) {
        return res.status(400).json({ ok: false, reason: 'empty', message: '未识别出有效视频链接' })
      }
      return res.status(200).json({ ok: true, course })
    }

    // 模式二：单个链接（可能是合集，也可能是单视频）
    const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
    const url = validVideoUrl(rawUrl)
    if (!url) {
      return res.status(400).json({ ok: false, reason: 'invalid-input', message: '视频地址不合法或暂不支持该平台' })
    }

    const ref = detectPlaylist(url)
    if (ref) {
      try {
        const { title, episodes } = await fetchPlaylistEpisodes(url)
        const sourceType: CourseSourceType = ref.platform
        const course: Course = {
          id: courseIdFromSource(url),
          title: title || `${ref.platform === 'bilibili' ? 'B站' : 'YouTube'}课程`,
          sourceUrl: url,
          sourceType,
          episodeCount: episodes.length,
          createdAt: Date.now(),
          episodes,
        }
        return res.status(200).json({ ok: true, course })
      } catch (err) {
        if (err instanceof PlaylistFetchError) {
          return res.status(200).json({
            ok: false,
            reason: 'playlist-fetch-failed',
            message: `自动解析合集失败：${err.message}。可改用「逐条粘贴视频链接」模式。`,
          })
        }
        throw err
      }
    }

    // 单视频：也包成一个章节的课程，保持入口一致
    const provider = detectProvider(url)
    const course: Course = {
      id: courseIdFromSource(url),
      title: '单视频课程',
      sourceUrl: url,
      sourceType: 'manual',
      episodeCount: 1,
      createdAt: Date.now(),
      episodes: [{ url, title: `${provider ?? '视频'} · 第 1 集`, provider: provider ?? undefined, order: 1 }],
    }
    return res.status(200).json({ ok: true, course })
  } catch (error) {
    logInternalError('api/course/resolve', error)
    return res.status(500).json({ ok: false, reason: 'invalid-input', message: publicError() })
  }
}
