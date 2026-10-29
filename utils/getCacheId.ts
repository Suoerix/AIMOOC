import { SummarizeParams } from '~/lib/types'

export function getCacheId(videoConfig: SummarizeParams['videoConfig']): string {
  const { videoId, pageNumber, ...options } = videoConfig
  const optionsKey = JSON.stringify(options)
  return `summary:${videoId}:${pageNumber || 1}:${optionsKey}`
}
