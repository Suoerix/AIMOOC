import { describe, it, expect } from 'vitest'
import { detectPlaylist, buildCourseFromUrls, PlaylistFetchError } from '~/lib/course/playlist'

describe('detectPlaylist', () => {
  it('识别 B站多P视频', () => {
    const ref = detectPlaylist('https://www.bilibili.com/video/BV1xx411c7mD?p=3')
    expect(ref).not.toBeNull()
    expect(ref?.platform).toBe('bilibili')
    expect(ref?.kind).toBe('bili-multipart')
    expect(ref?.id).toBe('BV1xx411c7mD')
  })

  it('识别 B站合集 ml', () => {
    const ref = detectPlaylist('https://www.bilibili.com/list/ml123456')
    expect(ref?.platform).toBe('bilibili')
    expect(ref?.kind).toBe('bili-collection')
    expect(ref?.id).toBe('123456')
  })

  it('识别 YouTube 播放列表', () => {
    const ref = detectPlaylist('https://www.youtube.com/playlist?list=PLabc123')
    expect(ref?.platform).toBe('youtube')
    expect(ref?.kind).toBe('yt-playlist')
    expect(ref?.id).toBe('PLabc123')
  })

  it('B站单视频识别为多P（解析后即为 1 集课程）', () => {
    const ref = detectPlaylist('https://www.bilibili.com/video/BV1xx411c7mD')
    expect(ref?.platform).toBe('bilibili')
    expect(ref?.kind).toBe('bili-multipart')
  })

  it('YouTube 普通 watch 链接（无 list）不算合集', () => {
    expect(detectPlaylist('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('非法输入返回 null', () => {
    expect(detectPlaylist('not a url')).toBeNull()
    expect(detectPlaylist('https://example.com/foo')).toBeNull()
  })
})

describe('buildCourseFromUrls', () => {
  it('过滤非法并保留顺序', () => {
    const course = buildCourseFromUrls([
      'https://www.bilibili.com/video/BV111',
      '乱码',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    ])
    expect(course).not.toBeNull()
    expect(course!.episodeCount).toBe(2)
    expect(course!.episodes[0].url).toContain('BV111')
    expect(course!.episodes[1].provider).toBe('youtube')
  })

  it('去重同一视频', () => {
    const course = buildCourseFromUrls([
      'https://www.bilibili.com/video/BV111',
      'https://www.bilibili.com/video/BV111?p=2',
    ])
    expect(course!.episodeCount).toBe(1)
  })

  it('空输入返回 null', () => {
    expect(buildCourseFromUrls(['', '   '])).toBeNull()
  })

  it('相同链接集合生成稳定 id', () => {
    const a = buildCourseFromUrls(['https://www.bilibili.com/video/BV111', 'https://www.youtube.com/watch?v=abc'])
    const b = buildCourseFromUrls(['https://www.youtube.com/watch?v=abc', 'https://www.bilibili.com/video/BV111'])
    expect(a!.id).toBe(b!.id)
  })
})

describe('PlaylistFetchError', () => {
  it('是 Error 子类且可识别', () => {
    const e = new PlaylistFetchError('x')
    expect(e).toBeInstanceOf(Error)
    expect(e).toBeInstanceOf(PlaylistFetchError)
  })
})
