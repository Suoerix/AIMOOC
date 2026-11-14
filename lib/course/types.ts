/**
 * 课程体系的数据模型。
 *
 * 设计要点：
 * - 一「课程」由若干「章节（episode）」组成，章节唯一依据是视频原始 url，
 *   与 /learn/[id] 的跳转、历史进度的反查保持一致（均走 learningIdFromUrl）。
 * - 课程可以是「单个合集/播放列表自动解析」或「用户手动逐条粘贴多链接」两种来源。
 */

export type CourseSourceType = 'bilibili' | 'youtube' | 'manual'

export interface CourseEpisode {
  /** 视频原始链接（与 learn 页跳转、历史进度对齐的唯一依据） */
  url: string
  /** 章节标题（解析不到时回退为「第 N 集」） */
  title: string
  provider?: string
  /** 第几集，从 1 开始，用于展示与排序 */
  order: number
}

export interface Course {
  /** 稳定课程 id：由 sourceUrl 派生，保证刷新/重载可定位 */
  id: string
  title: string
  sourceUrl: string
  sourceType: CourseSourceType
  episodeCount: number
  createdAt: number
  episodes: CourseEpisode[]
}

export type CourseResolveReason =
  | 'invalid-input'
  | 'unsupported-platform'
  | 'playlist-fetch-failed'
  | 'empty'

export interface CourseResolveResult {
  ok: boolean
  course?: Course
  /** 当 ok=false 时给前端的可读原因，用于引导「逐条粘贴」 */
  reason?: CourseResolveReason
  message?: string
}

/** 由课程来源链接派生稳定 id（与视频 learningId 思路一致） */
export function courseIdFromSource(sourceUrl: string): string {
  try {
    return (
      'c_' +
      btoa(sourceUrl)
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 12)
    )
  } catch {
    return 'c_' + sourceUrl.replace(/[^a-zA-Z0-9]/g, '').slice(-12)
  }
}
