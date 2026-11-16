import { useCallback, useEffect, useState } from 'react'
import type { Course } from '~/lib/course/types'
import { listCourses, saveCourseCollection, deleteCourseCollection } from '~/lib/course/store'

/** 课程集合的客户端状态钩子：从 localStorage 读取、保存、删除 */
export function useCourses() {
  const [courses, setCourses] = useState<Course[]>([])

  const refresh = useCallback(() => {
    setCourses(listCourses())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const save = useCallback(
    (course: Course) => {
      saveCourseCollection(course)
      refresh()
    },
    [refresh],
  )

  const remove = useCallback(
    (id: string) => {
      deleteCourseCollection(id)
      refresh()
    },
    [refresh],
  )

  return { courses, refresh, save, remove }
}
