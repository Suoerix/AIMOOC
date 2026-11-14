import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  BarChart3,
  Beaker,
  BookOpen,
  Boxes,
  CheckCircle2,
  Clapperboard,
  Cpu,
  Database,
  ExternalLink,
  FileDown,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  Globe,
  GraduationCap,
  History,
  Home,
  Key,
  LayoutGrid,
  Link2,
  ListChecks,
  Lock,
  MessageCircle,
  PenLine,
  Play,
  QrCode,
  Rocket,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  Stethoscope,
  StickyNote,
  Subtitles,
  Sun,
  Video,
  Volume2,
  Waves,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { TEACHING_CASES } from '~/lib/cases'
import { cn } from '~/lib/utils'

/* ============================================================
   类型定义
   ============================================================ */

/** 卡片状态标签的五种取值，对应契约约定的文案与配色。 */
type FeatureStatus = 'available' | 'login' | 'config' | 'demo' | 'manual'

interface StatusMeta {
  label: string
  icon: LucideIcon
  className: string
}

interface FeatureCardData {
  name: string
  desc: string
  href: string
  hrefLabel?: string
  status: FeatureStatus
  /** 覆盖状态标签文案，用于「需管理员」「运维接口」「可选」等特殊情形。 */
  statusText?: string
  icon: LucideIcon
  /** 学科信息，交互实验卡片从案例库读取。 */
  subject?: string
  /** 卡片补充说明。 */
  note?: string
  /** 视频来源的字幕获取模式。 */
  mode?: 'auto' | 'manual'
  /** 卡片图标主题色，交互实验卡片沿用案例库 accent。 */
  accent?: string
}

interface FeatureGroup {
  id: string
  index: string
  title: string
  desc: string
  icon: LucideIcon
  cards: FeatureCardData[]
  columns?: 2 | 3
}

/* ============================================================
   状态标签配色
   ============================================================ */

const STATUS_META: Record<FeatureStatus, StatusMeta> = {
  available: {
    label: '可用',
    icon: CheckCircle2,
    className: 'border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300',
  },
  login: {
    label: '需登录',
    icon: Lock,
    className: 'border-amber-400/25 bg-amber-400/[0.08] text-amber-300',
  },
  config: {
    label: '需配置',
    icon: Settings2,
    className: 'border-violet-400/25 bg-violet-400/[0.08] text-violet-300',
  },
  demo: {
    label: '演示',
    icon: Play,
    className: 'border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-300',
  },
  manual: {
    label: '手动字幕',
    icon: Subtitles,
    className: 'border-rose-400/25 bg-rose-400/[0.08] text-rose-300',
  },
}

/* ============================================================
   视频来源数据（本地兜底）
   字段与并行新增的 ~/lib/video 中 SUPPORTED_PLATFORMS 契约一致：
   name / hosts / mode / note。该模块可能尚未落地，为保证本页可独立编译，
   此处内置同构兜底数据；待模块就绪后可替换为：
   import { SUPPORTED_PLATFORMS } from '~/lib/video'
   ============================================================ */

interface VideoPlatform {
  name: string
  hosts: string[]
  mode: 'auto' | 'manual'
  note: string
}

const SUPPORTED_PLATFORMS: VideoPlatform[] = [
  {
    name: 'B 站',
    hosts: ['bilibili.com', 'b23.tv'],
    mode: 'auto',
    note: '可自动拉取官方字幕轨；扫码登录后可用高清字幕与完整播放。',
  },
  {
    name: 'YouTube',
    hosts: ['youtube.com', 'youtu.be'],
    mode: 'auto',
    note: '自动获取视频自带字幕与多语言字幕轨。',
  },
  {
    name: 'Vimeo',
    hosts: ['vimeo.com'],
    mode: 'auto',
    note: '自动读取 Vimeo 文本轨道作为课程字幕来源。',
  },
  {
    name: '直链视频',
    hosts: ['mp4 / m3u8 / webm 直链'],
    mode: 'manual',
    note: '粘贴音视频直链播放，需同时粘贴或上传 SRT / VTT 字幕。',
  },
  {
    name: '抖音',
    hosts: ['douyin.com'],
    mode: 'manual',
    note: '解析视频信息，字幕需手动粘贴或上传 SRT / VTT。',
  },
  {
    name: '西瓜视频',
    hosts: ['ixigua.com'],
    mode: 'manual',
    note: '解析视频信息，字幕需手动粘贴或上传 SRT / VTT。',
  },
  {
    name: '腾讯视频',
    hosts: ['v.qq.com'],
    mode: 'manual',
    note: '解析视频信息，字幕需手动粘贴或上传 SRT / VTT。',
  },
  {
    name: '优酷',
    hosts: ['youku.com'],
    mode: 'manual',
    note: '解析视频信息，字幕需手动粘贴或上传 SRT / VTT。',
  },
  {
    name: '爱奇艺',
    hosts: ['iqiyi.com'],
    mode: 'manual',
    note: '解析视频信息，字幕需手动粘贴或上传 SRT / VTT。',
  },
]

/* ============================================================
   分组数据：交互实验（学科信息来自案例库 TEACHING_CASES）
   ============================================================ */

const CASE_ICONS: Record<string, LucideIcon> = {
  projectile: Rocket,
  fourier: Waves,
  sorting: BarChart3,
  solar: Sun,
  fractal: GitBranch,
  periodic: Boxes,
}

const INTERACTIVE_CARDS: FeatureCardData[] = TEACHING_CASES.map((c) => ({
  name: c.title,
  subject: c.subject,
  desc: c.description,
  href: `/demo/${c.id}`,
  hrefLabel: '打开实验',
  status: 'demo',
  icon: CASE_ICONS[c.id] ?? FlaskConical,
  accent: c.accent,
}))

/* ============================================================
   分组数据：主页面
   ============================================================ */

const PAGE_CARDS: FeatureCardData[] = [
  {
    name: '首页',
    desc: '粘贴 B 站或视频链接，一键生成一堂 AI 课。',
    href: '/',
    hrefLabel: '前往首页',
    status: 'available',
    icon: Home,
  },
  {
    name: '学习历史',
    desc: '回看已学课程、学习时长与最近记录。',
    href: '/history',
    hrefLabel: '查看历史',
    status: 'login',
    icon: History,
    note: '登录后云端同步；本地记录无需登录也可查看。',
  },
  {
    name: '我的笔记',
    desc: '集中查看课堂笔记与 AI 生成笔记。',
    href: '/notes',
    hrefLabel: '查看笔记',
    status: 'login',
    icon: StickyNote,
  },
  {
    name: '学习进度',
    desc: '可视化掌握度、学习趋势与课程完成度。',
    href: '/progress',
    hrefLabel: '查看进度',
    status: 'login',
    icon: Gauge,
  },
  {
    name: '技术栈',
    desc: '架构、数据流、API 路由与部署环境变量说明。',
    href: '/tech',
    hrefLabel: '查看技术栈',
    status: 'available',
    icon: Cpu,
  },
  {
    name: '数据后台',
    desc: '用量、学习行为与账号聚合看板。',
    href: '/admin',
    hrefLabel: '进入后台',
    status: 'login',
    statusText: '需管理员',
    icon: BarChart3,
    note: '仅管理员账号可查看统计数据。',
  },
  {
    name: 'AI 教室',
    desc: '视频解析、课件、出题、可视化与 AI 助教的一体化课堂。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'demo',
    icon: GraduationCap,
    note: '常规入口为首页粘贴视频链接；此处为教室直达示例。',
  },
]

/* ============================================================
   分组数据：AI 教室能力（含界面入口的九项）
   ============================================================ */

const CLASSROOM_CARDS: FeatureCardData[] = [
  {
    name: '视频解析',
    desc: '解析链接，获取元信息、分 P、字幕轨与视频流。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'available',
    icon: Video,
  },
  {
    name: 'AI 课件',
    desc: '把字幕转成流式幻灯片课件，边讲边翻页。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'config',
    icon: BookOpen,
    note: '依赖 OPENAI_API_KEY。',
  },
  {
    name: 'AI 出题',
    desc: '按知识点生成互动选择题，附答案与解析。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'config',
    icon: ListChecks,
    note: '依赖 OPENAI_API_KEY。',
  },
  {
    name: '可视化实验',
    desc: '生成自包含的交互 HTML 实验，嵌入课堂舞台。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'config',
    icon: FlaskConical,
    note: '依赖 OPENAI_API_KEY。',
  },
  {
    name: 'AI 助教对话',
    desc: '基于课程上下文问答、追问与讲解。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'config',
    icon: MessageCircle,
    note: '依赖 OPENAI_API_KEY。',
  },
  {
    name: '课堂笔记',
    desc: '边看边记，支持保存并同步到我的笔记。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'login',
    icon: PenLine,
  },
  {
    name: '语音朗读 TTS',
    desc: '讯飞语音合成，把讲解与助教回复读出来。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'config',
    icon: Volume2,
    note: '依赖讯飞 XFYUN 系列配置。',
  },
  {
    name: '跳回视频',
    desc: '从课件或助教消息一键跳到视频对应时间点。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'available',
    icon: RotateCcw,
  },
  {
    name: 'B 站扫码登录',
    desc: '扫码或手动填入凭证，解锁高清字幕与完整播放。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'login',
    icon: QrCode,
  },
]

/* ============================================================
   分组数据：实验室 / 隐藏能力（已实现但原本无界面入口）
   ============================================================ */

const LAB_CARDS: FeatureCardData[] = [
  {
    name: '经典总结',
    desc: '对视频字幕生成要点摘要并写入缓存。',
    href: '/api/sumup',
    hrefLabel: 'POST /api/sumup',
    status: 'config',
    statusText: '运维接口',
    icon: FileText,
    note: '已实现但无独立界面入口，属纯接口；由前端或运维调用。',
  },
  {
    name: 'AI 笔记生成',
    desc: '按视频内容自动生成结构化学习笔记。',
    href: '/api/bilibili/notes',
    hrefLabel: 'POST /api/bilibili/notes',
    status: 'config',
    statusText: '运维接口',
    icon: PenLine,
    note: '已实现但无独立界面入口，属纯接口。',
  },
  {
    name: '字幕下载',
    desc: '把字幕转换为 SRT / VTT 文件并下载到本地。',
    href: '/learn/demo',
    hrefLabel: '进入教室',
    status: 'available',
    icon: FileDown,
    note: '转换逻辑位于 utils/subtitleConverter.ts，在教室字幕面板触发。',
  },
  {
    name: '诊断接口',
    desc: '排查 B 站字幕与开放接口的连通性与登录态。',
    href: '/api/bilibili/diagnose',
    hrefLabel: 'GET /api/bilibili/diagnose',
    status: 'config',
    statusText: '运维接口',
    icon: Stethoscope,
    note: '纯运维接口，可直接在浏览器打开查看诊断结果。',
  },
]

/* ============================================================
   分组数据：视频来源能力
   ============================================================ */

const VIDEO_SOURCE_CARDS: FeatureCardData[] = SUPPORTED_PLATFORMS.map((p) => ({
  name: p.name,
  desc: p.note,
  href: '/',
  hrefLabel: '粘贴链接使用',
  status: p.mode === 'auto' ? 'available' : 'manual',
  statusText: p.mode === 'auto' ? '自动字幕' : undefined,
  mode: p.mode,
  icon: p.mode === 'auto' ? Globe : Link2,
  note: p.hosts.join(' · '),
}))

/* ============================================================
   分组数据：配置状态说明
   ============================================================ */

const ENV_CARDS: FeatureCardData[] = [
  {
    name: 'OPENAI_API_KEY',
    desc: '驱动 AI 课件、AI 出题、可视化实验、助教对话、经典总结与 AI 笔记等生成类能力。',
    href: '/tech',
    hrefLabel: '查看技术栈',
    status: 'config',
    statusText: '必需',
    icon: Key,
  },
  {
    name: 'Supabase',
    desc: '账号登录、学习历史 / 笔记 / 进度云端同步、登录用户额度提升与后台统计。',
    href: '/tech',
    hrefLabel: '查看技术栈',
    status: 'config',
    statusText: '可选',
    icon: Database,
  },
  {
    name: 'Upstash Redis',
    desc: '缓存摘要结果，并对生成类接口做令牌桶限流。',
    href: '/tech',
    hrefLabel: '查看技术栈',
    status: 'config',
    statusText: '可选',
    icon: Server,
  },
  {
    name: '讯飞 TTS',
    desc: '提供 AI 助教与课件讲解的语音合成朗读（XFYUN 系列配置）。',
    href: '/tech',
    hrefLabel: '查看技术栈',
    status: 'config',
    statusText: '可选',
    icon: Volume2,
  },
]

const GROUPS: FeatureGroup[] = [
  {
    id: 'interactive',
    index: '01',
    title: '交互实验',
    desc: '六个内置可视化教学案例，覆盖物理、数学、计算机、天文与化学；名称、学科与说明直接读取案例库 TEACHING_CASES。',
    icon: FlaskConical,
    columns: 3,
    cards: INTERACTIVE_CARDS,
  },
  {
    id: 'pages',
    index: '02',
    title: '主页面',
    desc: '站点全部主页面入口，以及 AI 教室的直达链接。',
    icon: LayoutGrid,
    columns: 3,
    cards: PAGE_CARDS,
  },
  {
    id: 'classroom',
    index: '03',
    title: 'AI 教室能力',
    desc: '视频进入教室后可使用的全部能力。字幕下载、经典总结、AI 笔记等已实现但无独立界面入口的能力，统一见下方「实验室 / 隐藏能力」。',
    icon: Clapperboard,
    columns: 3,
    cards: CLASSROOM_CARDS,
  },
  {
    id: 'lab',
    index: '04',
    title: '实验室 / 隐藏能力',
    desc: '已实现但原本没有界面入口的能力：能跳转的回到教室触发，纯接口标注为运维接口并给出调用路径。',
    icon: Beaker,
    columns: 2,
    cards: LAB_CARDS,
  },
  {
    id: 'sources',
    index: '05',
    title: '视频来源能力',
    desc: '支持的视频平台与字幕获取方式。auto 可自动拉取字幕，manual 需手动粘贴或上传 SRT / VTT 字幕文件。',
    icon: Globe,
    columns: 3,
    cards: VIDEO_SOURCE_CARDS,
  },
]

/* ============================================================
   通用小组件
   ============================================================ */

const StatusBadge = ({ status, text }: { status: FeatureStatus; text?: string }) => {
  const meta = STATUS_META[status]
  const Icon = meta.icon
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px]',
        meta.className,
      )}
    >
      <Icon className="h-3 w-3" />
      {text ?? meta.label}
    </span>
  )
}

const LINK_CLASS =
  'inline-flex items-center gap-1 text-[12px] font-medium text-cyan-300/90 transition-colors duration-200 hover:text-cyan-200'

const FeatureCard = ({ card }: { card: FeatureCardData }) => {
  const Icon = card.icon
  const isApi = card.href.startsWith('/api/')

  const iconBoxStyle = card.accent
    ? {
        color: card.accent,
        borderColor: `${card.accent}33`,
        backgroundColor: `${card.accent}14`,
      }
    : undefined

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45 }}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/30 hover:bg-white/[0.05]"
    >
      {/* 悬停光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/[0.07] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border',
            !card.accent && 'border-cyan-400/20 bg-cyan-400/[0.07] text-cyan-300',
          )}
          style={iconBoxStyle}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <StatusBadge status={card.status} text={card.statusText} />
      </div>

      <h3 className="mt-4 text-[15px] font-semibold text-slate-100">{card.name}</h3>
      {card.subject && <p className="mt-1 font-mono text-[11px] text-cyan-300/70">{card.subject}</p>}
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">{card.desc}</p>

      {/* 视频来源的 mode 徽章 */}
      {card.mode && (
        <div className="mt-3">
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2 py-1 font-mono text-[10.5px]',
              card.mode === 'auto'
                ? 'border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300/90'
                : 'border-rose-400/20 bg-rose-400/[0.06] text-rose-300/90',
            )}
          >
            {card.mode === 'auto' ? 'auto 自动字幕' : 'manual 需粘贴或上传 SRT / VTT'}
          </span>
        </div>
      )}

      {card.note && <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">{card.note}</p>}

      <div className="mt-auto pt-4">
        {isApi ? (
          <a href={card.href} target="_blank" rel="noreferrer" className={LINK_CLASS}>
            {card.hrefLabel ?? card.href}
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : (
          <Link href={card.href} className={LINK_CLASS}>
            {card.hrefLabel ?? '进入'}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </motion.div>
  )
}

const GroupHeader = ({ group }: { group: Pick<FeatureGroup, 'index' | 'title' | 'desc' | 'icon'> }) => {
  const Icon = group.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.21, 1.02, 0.73, 1] }}
      className="mb-7"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07]">
          <Icon className="h-[18px] w-[18px] text-cyan-300" />
        </span>
        <span className="font-mono text-xs text-cyan-300/70">{group.index}</span>
        <h2 className="text-xl font-semibold text-slate-100 sm:text-2xl">{group.title}</h2>
        <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 via-violet-400/20 to-transparent" />
      </div>
      <p className="mt-2.5 max-w-3xl pl-12 text-sm leading-relaxed text-slate-500">{group.desc}</p>
    </motion.div>
  )
}

const GroupSection = ({ group }: { group: FeatureGroup }) => (
  <section id={group.id} className="scroll-mt-24 py-10">
    <GroupHeader group={group} />
    <div
      className={cn('grid grid-cols-1 gap-4', group.columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3')}
    >
      {group.cards.map((card) => (
        <FeatureCard key={card.name} card={card} />
      ))}
    </div>
  </section>
)

/* ============================================================
   配置状态区：额度 / B 站登录实时状态
   ============================================================ */

interface QuotaResponse {
  tier?: string
  unlimited?: boolean
  generate?: { limit?: number; remaining?: number }
}

interface QuotaState {
  loading: boolean
  error: boolean
  unlimited: boolean | null
  remaining: number | null
  limit: number | null
  tier: string | null
}

const INITIAL_QUOTA: QuotaState = {
  loading: true,
  error: false,
  unlimited: null,
  remaining: null,
  limit: null,
  tier: null,
}

interface BiliState {
  loggedIn: boolean
  uname: string | null
}

interface RuntimeCardProps {
  icon: LucideIcon
  title: string
  value: string
  desc: string
  status: FeatureStatus
  statusText: string
  dimValue?: boolean
}

const RuntimeCard = ({ icon: Icon, title, value, desc, status, statusText, dimValue }: RuntimeCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-40px' }}
    transition={{ duration: 0.5 }}
    className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors duration-300 hover:border-cyan-400/30"
  >
    <div className="flex items-start justify-between gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07]">
        <Icon className="h-[18px] w-[18px] text-cyan-300" />
      </span>
      <StatusBadge status={status} text={statusText} />
    </div>
    <p className="mt-4 text-[12px] text-slate-500">{title}</p>
    <p className={cn('mt-1 text-2xl font-semibold', dimValue ? 'text-slate-400' : 'text-slate-100')}>{value}</p>
    <p className="mt-2 text-[12px] leading-relaxed text-slate-500">{desc}</p>
  </motion.div>
)

const ConfigStatusSection = () => {
  const [quota, setQuota] = useState<QuotaState>(INITIAL_QUOTA)
  const [bili, setBili] = useState<BiliState>({ loggedIn: false, uname: null })

  // 读取 /api/quota，失败时优雅降级，不让页面报错
  useEffect(() => {
    let alive = true
    const controller = new AbortController()

    fetch('/api/quota', { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<QuotaResponse>) : null))
      .then((d) => {
        if (!alive) return
        if (!d) {
          setQuota({ ...INITIAL_QUOTA, loading: false, error: true })
          return
        }
        setQuota({
          loading: false,
          error: false,
          unlimited: Boolean(d.unlimited),
          remaining: typeof d.generate?.remaining === 'number' ? d.generate.remaining : null,
          limit: typeof d.generate?.limit === 'number' ? d.generate.limit : null,
          tier: typeof d.tier === 'string' ? d.tier : null,
        })
      })
      .catch(() => {
        if (alive) setQuota((q) => ({ ...q, loading: false, error: true }))
      })

    return () => {
      alive = false
      controller.abort()
    }
  }, [])

  // 新版仅把 mid / uname 等公开信息写入 bilibili_user，凭证不落 localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('bilibili_user')
      if (!raw) return
      const parsed = JSON.parse(raw) as { uname?: string; mid?: number | string }
      if (parsed && (parsed.uname || parsed.mid != null)) {
        setBili({ loggedIn: true, uname: parsed.uname ?? null })
      }
    } catch {
      // 本地公开信息缺失或格式异常时保持未登录，不影响页面渲染
    }
  }, [])

  const quotaView = (() => {
    if (quota.loading) {
      return {
        status: 'demo' as FeatureStatus,
        statusText: '检测中',
        value: '检测中…',
        desc: '正在读取 /api/quota 的额度信息。',
        dim: true,
      }
    }
    if (quota.error) {
      return {
        status: 'config' as FeatureStatus,
        statusText: '降级',
        value: '暂不可用',
        desc: '额度接口未响应，已优雅降级；不影响页面浏览与各功能使用。',
        dim: true,
      }
    }
    if (quota.unlimited) {
      return {
        status: 'available' as FeatureStatus,
        statusText: '不限量',
        value: 'unlimited',
        desc: '当前额度为 unlimited，生成类能力不受每日次数限制。',
        dim: false,
      }
    }
    return {
      status: 'available' as FeatureStatus,
      statusText: '限量',
      value: `${quota.remaining ?? '—'} / ${quota.limit ?? '—'}`,
      desc: `当前额度档位 ${quota.tier ?? 'anon'}，为今日生成类调用的剩余次数。`,
      dim: false,
    }
  })()

  const biliView = bili.loggedIn
    ? {
        status: 'available' as FeatureStatus,
        statusText: '已登录',
        value: bili.uname ?? '已登录',
        desc: '本地仅保存 mid / uname 等公开信息用于状态展示，登录凭证不落在 localStorage。',
      }
    : {
        status: 'login' as FeatureStatus,
        statusText: '未登录',
        value: '未登录',
        desc: '读取 localStorage 的 bilibili_user 公开信息判断状态；扫码登录后可拉取高清字幕。',
      }

  return (
    <section id="config" className="scroll-mt-24 py-10">
      <GroupHeader
        group={{
          index: '06',
          title: '配置状态',
          desc: '运行时读取当前额度与 B 站登录状态，并说明各环境变量影响的功能范围。',
          icon: Settings2,
        }}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <RuntimeCard
          icon={Gauge}
          title="当前额度 /api/quota"
          value={quotaView.value}
          desc={quotaView.desc}
          status={quotaView.status}
          statusText={quotaView.statusText}
          dimValue={quotaView.dim}
        />
        <RuntimeCard
          icon={ShieldCheck}
          title="B 站登录状态 bilibili_user"
          value={biliView.value}
          desc={biliView.desc}
          status={biliView.status}
          statusText={biliView.statusText}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {ENV_CARDS.map((card) => (
          <FeatureCard key={card.name} card={card} />
        ))}
      </div>
    </section>
  )
}

/* ============================================================
   功能总览目录
   ============================================================ */

export function FeatureCatalog() {
  return (
    <>
      {GROUPS.map((group) => (
        <GroupSection key={group.id} group={group} />
      ))}
      <ConfigStatusSection />
    </>
  )
}

export default FeatureCatalog
