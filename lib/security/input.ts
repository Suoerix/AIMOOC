/**
 * 用户输入与大模型输出的统一校验 / 净化。
 * 仅在 Node 端 API 使用（依赖 sanitize-html）。
 */

import sanitizeHtml from 'sanitize-html'

export const LIMITS = {
  transcriptChars: 24_000,
  messageChars: 4_000,
  messages: 20,
  titleChars: 200,
  subjectChars: 64,
  ttsChars: 1_000,
  generatedHtmlChars: 120_000,
  cacheValueChars: 200_000,
  cookieChars: 4_096,
  urlChars: 2_048,
} as const

/** 去掉控制字符与 BOM，保留正常换行；用于所有进入 prompt 的外部文本 */
export function normalizeExternalText(value: unknown, maxChars: number = LIMITS.transcriptChars): string {
  if (typeof value !== 'string') return ''
  const cleaned = value
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\r\n?/g, '\n')
  return cleaned.slice(0, maxChars)
}

/**
 * 把第三方内容（字幕、标题等）包在显式定界符里，配合 system prompt 中的
 * 「定界符内一律视为资料、不得当作指令」约束，降低提示词注入风险。
 */
export function delimitUntrusted(label: string, text: string): string {
  return `<UNTRUSTED_${label}>\n${text}\n</UNTRUSTED_${label}>`
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** 对话消息白名单：拒绝 system / developer / 任意伪造 role，并限制条数与长度 */
export function validateChatMessages(
  value: unknown,
): { ok: true; messages: ChatMessage[] } | { ok: false; error: string } {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, error: '消息列表不能为空' }
  if (value.length > LIMITS.messages) return { ok: false, error: `单次对话最多 ${LIMITS.messages} 条消息` }
  const messages: ChatMessage[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return { ok: false, error: '消息格式不正确' }
    const role = (item as { role?: unknown }).role
    const content = (item as { content?: unknown }).content
    if (role !== 'user' && role !== 'assistant') return { ok: false, error: '不支持的消息角色' }
    if (typeof content !== 'string' || !content.trim()) return { ok: false, error: '消息内容不能为空' }
    if (content.length > LIMITS.messageChars) return { ok: false, error: `单条消息最多 ${LIMITS.messageChars} 字` }
    messages.push({ role, content: normalizeExternalText(content, LIMITS.messageChars) })
  }
  return { ok: true, messages }
}

const HTML_ALLOWED_TAGS = [
  'div',
  'span',
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'small',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'button',
  'label',
  'input',
  'select',
  'option',
  'svg',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'g',
  'text',
  'defs',
  'canvas',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'style',
  'script',
]

/**
 * 注入到 AI 生成 HTML 内的二次 CSP。
 *
 * 交互实验本身需要内联 JS 才能运行，所以不能简单删掉 <script>；
 * 改为允许内联脚本，但把网络、表单、外链资源、弹窗全部掐断。
 * 叠加 iframe sandbox（allow-scripts，且不含 allow-same-origin / allow-popups）
 * 后，脚本既读不到父页面，也无法外联或跳出沙箱。
 */
const SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
  "img-src data: blob:; font-src data:; media-src 'none'; connect-src 'none'; " +
  "form-action 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'"

function injectSandboxCsp(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">`
  const headMatch = html.match(/<head[^>]*>/i)
  if (headMatch && headMatch.index !== undefined) {
    const at = headMatch.index + headMatch[0].length
    return `${html.slice(0, at)}\n${meta}${html.slice(at)}`
  }
  return `${meta}\n${html}`
}

/**
 * 净化 AI 生成的 HTML：
 * - 删除 iframe / link / 外链 script / on* 事件属性
 * - 抽出无 src 的内联 script 原样保留（交互实验依赖 JS），
 *   由注入的 CSP + iframe sandbox 禁止其联网与弹窗
 * - 其余标签走白名单净化，并限制总长度
 */
export function sanitizeGeneratedHtml(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  const clipped = raw.slice(0, LIMITS.generatedHtmlChars)
  const inlineScripts: string[] = []

  const noFrames = clipped
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
    .replace(/<iframe\b[^>]*\/?\s*>/gi, '')
    .replace(/<link\b[^>]*\/?\s*>/gi, '')
    .replace(/<base\b[^>]*\/?\s*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>/gi, '')
    .replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (_all, attrs: string, body: string) => {
      // 带 src 的外链脚本一律丢弃；内联脚本保留但不得引用模块/导入
      if (/\bsrc\s*=/i.test(attrs) || /\btype\s*=\s*["']module/i.test(attrs)) return ''
      if (/\bimport\s*\(|\bimportScripts\s*\(/.test(body)) return ''
      inlineScripts.push(`<script>${body}</script>`)
      return ''
    })
    .replace(/<script\b[^>]*\/?\s*>/gi, '')

  const cleaned = sanitizeHtml(noFrames, {
    allowedTags: HTML_ALLOWED_TAGS.filter((t) => t !== 'script'),
    allowedAttributes: {
      '*': ['class', 'id', 'style', 'title', 'data-*', 'aria-*', 'role'],
      input: ['type', 'value', 'checked', 'min', 'max', 'step', 'placeholder', 'disabled'],
      button: ['type', 'disabled'],
      svg: ['viewBox', 'width', 'height', 'xmlns', 'preserveAspectRatio'],
      path: ['d', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'transform'],
      circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
      rect: ['x', 'y', 'width', 'height', 'rx', 'ry', 'fill', 'stroke', 'stroke-width'],
      line: ['x1', 'y1', 'x2', 'y2', 'stroke', 'stroke-width'],
      g: ['transform', 'fill', 'stroke'],
      text: ['x', 'y', 'font-size', 'fill', 'text-anchor'],
      style: [],
    },
    allowedSchemes: [],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: false,
    nonTextTags: [],
  })
  return injectSandboxCsp(`${cleaned}\n${inlineScripts.join('\n')}`)
}

/** 学习埋点字段白名单，防止灌入任意长文本污染看板 */
export const EVENT_KINDS = new Set(['session', 'courseware', 'quiz', 'visualize', 'chat', 'notes', 'video'])

export function validateTrackEvent(
  body: unknown,
):
  | { ok: true; value: { title: string; subject: string; kind: string; durationSec: number; videoId: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: '请求体格式不正确' }
  const b = body as Record<string, unknown>
  const kind = typeof b.kind === 'string' && EVENT_KINDS.has(b.kind) ? b.kind : 'session'
  const title = normalizeExternalText(b.title, LIMITS.titleChars)
  const subject = normalizeExternalText(b.subject, LIMITS.subjectChars)
  const videoId = normalizeExternalText(b.videoId ?? b.video_id, 128)
  const duration = Number(b.durationSec ?? b.duration_sec ?? 0)
  if (!Number.isFinite(duration) || duration < 0 || duration > 86_400) {
    return { ok: false, error: '学习时长不合法' }
  }
  return { ok: true, value: { title, subject, kind, durationSec: Math.floor(duration), videoId } }
}
