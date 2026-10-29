import { SubtitleData, VideoConfig } from '~/lib/types'
import { formatTime } from '~/utils/formatTime'

export function subtitlesToText(
  subtitles: SubtitleData[],
  showTimestamp: boolean
): string {
  const primary = subtitles[0]
  if (!primary) return ''
  return primary.subtitle
    .map((item) => {
      const content = item.content.replace(/\s+/g, ' ').trim()
      return showTimestamp ? `[${item.from.toFixed(2)}] ${content}` : content
    })
    .join('\n')
}

const DETAIL_LEVELS = [
  '简洁概要',
  '适中详细',
  '非常详细',
  '极其详尽',
]

export function buildSummarizePrompt(videoConfig: VideoConfig): string {
  const {
    showTimestamp,
    showEmoji,
    detailLevel,
    sentenceNumber,
    outlineLevel,
    outputLanguage,
  } = videoConfig

  const lines = [
    `你是一位专业的视频内容总结助手。请根据提供的视频字幕生成结构化的学习笔记。`,
    `输出语言：${outputLanguage || '中文'}。`,
    `详细程度：${DETAIL_LEVELS[Math.min(Math.max(detailLevel || 2, 1), 4) - 1]}。`,
    `每个要点用 ${sentenceNumber || 2} 句话阐述。`,
    `大纲层级：${Math.min(Math.max(outlineLevel || 2, 1), 4)} 级。`,
    showTimestamp
      ? '为每个要点标注字幕中的时间戳，格式为 [秒数]，例如 [12.34]。'
      : '不需要标注时间戳。',
    showEmoji
      ? '适当使用 emoji 让笔记更生动。'
      : '不要使用 emoji。',
    '使用 Markdown 格式输出，包含「总结：」和「要点」两个部分。',
  ]
  return lines.join('\n')
}

export const NOTES_SYSTEM_PROMPT = `你是一位专业的视频课程笔记助手。请根据提供的视频字幕生成笔记，严格按照以下格式输出：

# 总结：
（用一段话概括视频核心内容）

# 要点
[12.34] 第一个要点内容
[45.67] 第二个要点内容

要求：
1. 「总结：」部分简洁概括视频核心主题
2. 「要点」部分每行一条，以 [时间戳秒数] 开头，时间戳必须来自字幕的真实时间
3. 要点覆盖视频中的关键知识点，保留重要细节
4. 使用与字幕相同的语言输出`

export const CHAT_SYSTEM_PROMPT =
  '你是一位友好的 AI 学习助教，帮助学生解答学习过程中遇到的问题。回答要准确、简洁、有条理。'
