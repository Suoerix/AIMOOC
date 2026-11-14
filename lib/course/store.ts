/**
 * 课程集合的本地存储层。
 *
 * 与 lib/history 解耦：课程是「章节编排」的容器，章节进度复用已有的学习历史
 * （listLocalCourses），按视频链接对齐，无需重复存储。所有读写都对 localStorage
 * 做 try/catch 降级，隐私模式/存储满时静默忽略。
 */

import type { Course } from './types'
import { learningIdFromUrl, listLocalCourses } from '~/lib/history'

const COURSE_STORE_KEY = 'aimooc_course_collections_v1'
const MAX_COURSES = 100

function readAll(): Course[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(COURSE_STORE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Course[]) : []
  } catch {
    return []
  }
}

function writeAll(courses: Course[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COURSE_STORE_KEY, JSON.stringify(courses.slice(0, MAX_COURSES)))
  } catch {
    /* 忽略 */
  }
}

export function listCourses(): Course[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt)
}

export function getCourse(id: string): Course | null {
  return readAll().find((c) => c.id === id) ?? null
}

export function saveCourseCollection(course: Course): Course {
  const all = readAll()
  const idx = all.findIndex((c) => c.id === course.id)
  if (idx >= 0) all[idx] = course
  else all.unshift(course)
  writeAll(all)
  return course
}

export function deleteCourseCollection(id: string): void {
  writeAll(readAll().filter((c) => c.id !== id))
}

/**
 * 反查某章节的学习进度（0-100）。
 * 优先按视频 url 精确匹配学习历史；次之用 learningId 对齐。
 */
export function episodeProgress(episodeUrl: string): number {
  const records = listLocalCourses()
  const id = learningIdFromUrl(episodeUrl)
  const hit = records.find((r) => r.url === episodeUrl || r.videoId === id)
  return hit?.progress ?? 0
}

/** 课程整体进度（各章节进度均值） */
export function courseProgress(course: Course): number {
  if (course.episodes.length === 0) return 0
  const sum = course.episodes.reduce((s, ep) => s + episodeProgress(ep.url), 0)
  return Math.round(sum / course.episodes.length)
}
