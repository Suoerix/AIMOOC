import type { NextPage } from 'next'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Bot,
  Code2,
  Component,
  Database,
  Gauge,
  Layers,
  Mic,
  Palette,
  Paintbrush,
  Rocket,
  Server,
  ShieldCheck,
  Terminal,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Nav } from '~/components/Nav'
import { cn } from '~/lib/utils'

/* ============================================================
   类型定义
   ============================================================ */

interface TechItem {
  icon: LucideIcon
  name: string
  version: string
  desc: string
  category: string
}

interface FlowStep {
  title: string
  apis: string[]
  output: string
}

interface ApiRow {
  method: 'GET' | 'POST'
  path: string
  purpose: string
}

interface DirRow {
  dir: string
  items: string
}

interface EnvVar {
  name: string
  required: boolean
  desc: string
}

/* ============================================================
   数据
   ============================================================ */

const TECH_STACK: TechItem[] = [
  {
    icon: Layers,
    name: 'Next.js',
    version: '14.2',
    desc: 'Pages Router 页面渲染，API Routes 同时承担全部后端接口。',
    category: '框架',
  },
  {
    icon: Code2,
    name: 'TypeScript',
    version: '5.x',
    desc: 'strict 模式全链路类型约束，前后端接口契约零隐式 any。',
    category: '语言',
  },
  {
    icon: Paintbrush,
    name: 'Tailwind CSS',
    version: '3.2',
    desc: '原子化类名之上自建玻璃态 / 极光视觉系统，设计令牌统一。',
    category: '样式',
  },
  {
    icon: Zap,
    name: 'framer-motion',
    version: '9.x',
    desc: '声明式动画编排，负责页面入场、滚动区块揭示与转场。',
    category: '动效',
  },
  {
    icon: Bot,
    name: 'OpenAI SDK',
    version: '4.73',
    desc: '统一驱动流式对话、课件生成、可视化实验与互动题产出。',
    category: 'AI',
  },
  {
    icon: Mic,
    name: '讯飞语音合成',
    version: 'v2',
    desc: 'WebSocket 流式 TTS，AI 助教把讲解文本转成真人语音。',
    category: '语音',
  },
  {
    icon: Database,
    name: 'Supabase',
    version: '2.x',
    desc: '提供账号体系与学习数据持久化，浏览器侧直连鉴权。',
    category: '数据',
  },
  {
    icon: Gauge,
    name: 'Upstash Redis',
    version: '1.40',
    desc: 'REST 协议缓存摘要结果，并对生成类接口做令牌桶限流。',
    category: '缓存',
  },
  {
    icon: Rocket,
    name: 'Vercel',
    version: 'Serverless',
    desc: '无状态函数直接部署，region 锁定 hkg1 贴近 B 站与国内用户。',
    category: '部署',
  },
  {
    icon: Palette,
    name: 'lucide-react',
    version: '0.122',
    desc: '统一线性图标语言，描边风格与深色玻璃面板高度契合。',
    category: '图标',
  },
  {
    icon: Component,
    name: 'shadcn 风格组件',
    version: 'Tailwind 变体',
    desc: '基于 CVA 的变体封装，无运行时依赖，样式完全由 Tailwind 掌控。',
    category: 'UI',
  },
  {
    icon: ShieldCheck,
    name: 'Zod',
    version: '3.21',
    desc: 'API 入参运行时校验，非法请求在进入业务前即被拦截。',
    category: '校验',
  },
]

const FLOW_STEPS: FlowStep[] = [
  {
    title: '输入 B 站链接',
    apis: ['GET /api/b23tv', 'GET /api/bilibili/info'],
    output: '视频元信息',
  },
  {
    title: '抓取字幕轨',
    apis: ['GET /api/bilibili/subtitle'],
    output: '字幕文本（SRT / VTT）',
  },
  {
    title: '生成课件',
    apis: ['POST /api/courseware'],
    output: '流式课件幻灯片',
  },
  {
    title: '生成可视化实验',
    apis: ['POST /api/visualize'],
    output: '流式自包含交互 HTML',
  },
  {
    title: '生成互动题',
    apis: ['POST /api/quiz'],
    output: '互动题 JSON',
  },
  {
    title: '语音讲解与埋点',
    apis: ['POST /api/tts', 'POST /api/track'],
    output: 'MP3 语音 + 学习记录',
  },
]

const API_ROWS: ApiRow[] = [
  { method: 'POST', path: '/api/courseware', purpose: '字幕 → 流式课件（#S / #T 行协议）' },
  { method: 'POST', path: '/api/visualize', purpose: '字幕 → 流式自包含交互实验 HTML' },
  { method: 'POST', path: '/api/quiz', purpose: '字幕 → 互动题 JSON（题干 / 选项 / 答案 / 解析）' },
  { method: 'POST', path: '/api/chat', purpose: 'AI 对话，mode 支持 router（主页接待）与 ta（教室助教）' },
  { method: 'POST', path: '/api/tts', purpose: '讯飞在线语音合成，返回 base64 编码的 MP3' },
  { method: 'POST', path: '/api/track', purpose: '学习埋点上报，记录观看与答题行为' },
  { method: 'GET', path: '/api/admin/stats', purpose: '后台看板聚合统计（用量 / 学习 / 账号）' },
  { method: 'GET', path: '/api/bilibili/info', purpose: 'B 站视频基础信息（标题 / 时长 / 分 P）' },
  { method: 'GET', path: '/api/bilibili/subtitle', purpose: '拉取视频字幕轨文本' },
  { method: 'GET', path: '/api/bilibili/video', purpose: '获取视频流地址，供播放器播放' },
  { method: 'GET', path: '/api/bilibili/login/*', purpose: '扫码登录：二维码生成与登录态轮询' },
  { method: 'GET', path: '/api/b23tv', purpose: 'b23.tv 短链解析，还原真实 BV 号' },
  { method: 'POST', path: '/api/sumup', purpose: '视频内容总结，生成要点摘要并写入缓存' },
]

const DIR_TREE: DirRow[] = [
  { dir: 'components/', items: 'Home(主页)  classroom(教室)  admin(后台)  auth(登录)' },
  { dir: 'hooks/', items: 'useCourseware  useVisualize  useQuiz  useTTS  useAuth  useHistory' },
  { dir: 'lib/', items: 'cases(案例库)  ai/prompts  tts/xunfei  bilibili  history  quota' },
  { dir: 'pages/', items: 'index  demo/[case]  learn/[id]  history  notes  progress  admin  tech' },
]

const ENV_VARS: EnvVar[] = [
  { name: 'OPENAI_API_KEY', required: true, desc: '大模型网关鉴权，课件 / 可视化 / 出题 / 对话均依赖' },
  { name: 'XFYUN_APP_ID', required: false, desc: '讯飞开放平台应用标识' },
  { name: 'XFYUN_API_KEY', required: false, desc: '讯飞 WebSocket 语音合成鉴权' },
  { name: 'XFYUN_API_SECRET', required: false, desc: '讯飞签名密钥，用于生成鉴权 URL' },
  { name: 'NEXT_PUBLIC_SUPABASE_URL', required: false, desc: 'Supabase 项目地址' },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: false, desc: 'Supabase 匿名密钥，浏览器侧公开' },
  { name: 'UPSTASH_REDIS_REST_URL', required: false, desc: 'Redis REST 端点，用于摘要缓存' },
  { name: 'UPSTASH_REDIS_REST_TOKEN', required: false, desc: 'Redis REST 令牌' },
  { name: 'UPSTASH_RATE_REDIS_REST_URL', required: false, desc: '限流专用 Redis 端点' },
  { name: 'UPSTASH_RATE_REDIS_REST_TOKEN', required: false, desc: '限流专用 Redis 令牌' },
  { name: 'BILIBILI_SESSION_TOKEN', required: false, desc: 'B 站 SESSDATA，服务端兜底取字幕' },
  { name: 'BILIBILI_PROXY', required: false, desc: '海外部署时走代理访问 B 站开放接口' },
  { name: 'BILIBILI_API_BASE', required: false, desc: '自建反代地址，优先级低于 BILIBILI_PROXY' },
]

/* ============================================================
   通用小组件
   ============================================================ */

interface SectionTitleProps {
  index: string
  title: string
  desc: string
}

const SectionTitle = ({ index, title, desc }: SectionTitleProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.6, ease: [0.21, 1.02, 0.73, 1] }}
    className="mb-8"
  >
    <div className="flex items-center gap-3">
      <span className="font-mono text-xs text-cyan-300/70">{index}</span>
      <h2 className="text-2xl font-semibold text-slate-100 sm:text-[26px]">{title}</h2>
      <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 via-violet-400/20 to-transparent" />
    </div>
    <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p>
  </motion.div>
)

/* ============================================================
   三层架构图（纯 SVG 手绘）
   ============================================================ */

const ARCH_BROWSER = [
  { x: 183, w: 238, title: '主页 Chatbot 入口', sub: '对话式选课 · 案例库' },
  { x: 451, w: 238, title: 'AI 教室', sub: '可视化舞台 + AI 助教' },
  { x: 719, w: 238, title: '后台看板', sub: '用量 · 学习数据 · 账号' },
]

const ARCH_APIS = [
  '/api/courseware',
  '/api/visualize',
  '/api/quiz',
  '/api/chat',
  '/api/tts',
  '/api/track',
  '/api/bilibili 代理',
]

const ARCH_EXTERNAL = [
  { x: 182, w: 143, title: 'B 站开放接口', sub: '字幕 · 视频流' },
  { x: 340, w: 143, title: '大模型网关', sub: '流式推理' },
  { x: 498, w: 143, title: '讯飞 TTS', sub: 'WebSocket 合成' },
  { x: 656, w: 143, title: 'Supabase', sub: '账号 · 学习数据' },
  { x: 814, w: 143, title: 'Upstash', sub: '缓存 · 限流' },
]

const ARCH_API_CHIP = { x: 185, w: 185, h: 34, gap: 10 }

const ArchitectureDiagram = () => (
  <motion.div
    initial={{ opacity: 0, y: 28 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: '-60px' }}
    transition={{ duration: 0.7, ease: [0.21, 1.02, 0.73, 1] }}
    className="glass-strong overflow-hidden rounded-2xl border border-white/[0.06]"
  >
    <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
      <Terminal className="h-4 w-4 text-cyan-300" />
      <span className="font-mono text-xs text-slate-400">architecture.svg</span>
      <span className="ml-auto font-mono text-[10.5px] text-slate-600">
        browser → serverless → external
      </span>
    </div>

    <div className="overflow-x-auto scrollbar-thin">
      <svg
        viewBox="0 0 1000 560"
        width="1000"
        height="560"
        className="h-auto w-full min-w-[760px]"
        role="img"
        aria-label="AIMOOC 三层架构图"
      >
        <defs>
          <linearGradient id="archGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
          <marker
            id="archArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#22d3ee" />
          </marker>
          <marker
            id="archArrowAlt"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#a78bfa" />
          </marker>
        </defs>

        {/* ---------- 左侧层标签栏（独立留白，避免与箭头重叠） ---------- */}
        <g>
          <rect
            x="20"
            y="66"
            width="104"
            height="52"
            rx="9"
            fill="rgba(34,211,238,0.06)"
            stroke="#22d3ee"
            strokeOpacity="0.25"
            strokeWidth="1"
          />
          <text
            x="72"
            y="88"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="12"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            浏览器层
          </text>
          <text
            x="72"
            y="104"
            textAnchor="middle"
            fill="#475569"
            fontSize="9"
            letterSpacing="1"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            BROWSER
          </text>

          <rect
            x="20"
            y="238"
            width="104"
            height="52"
            rx="9"
            fill="rgba(167,139,250,0.06)"
            stroke="#a78bfa"
            strokeOpacity="0.25"
            strokeWidth="1"
          />
          <text
            x="72"
            y="260"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="12"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            服务层
          </text>
          <text
            x="72"
            y="276"
            textAnchor="middle"
            fill="#475569"
            fontSize="9"
            letterSpacing="1"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            SERVERLESS
          </text>

          <rect
            x="20"
            y="418"
            width="104"
            height="52"
            rx="9"
            fill="rgba(56,189,248,0.06)"
            stroke="#38bdf8"
            strokeOpacity="0.25"
            strokeWidth="1"
          />
          <text
            x="72"
            y="440"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="12"
            fontFamily="ui-sans-serif, system-ui, sans-serif"
          >
            外部服务层
          </text>
          <text
            x="72"
            y="456"
            textAnchor="middle"
            fill="#475569"
            fontSize="9"
            letterSpacing="1"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            EXTERNAL
          </text>
        </g>

        {/* ---------- 浏览器层节点 ---------- */}
        {ARCH_BROWSER.map((n) => {
          const cx = n.x + n.w / 2
          return (
            <g key={n.title}>
              <rect
                x={n.x}
                y="50"
                width={n.w}
                height="84"
                rx="12"
                fill="#070d1c"
                stroke="#22d3ee"
                strokeOpacity="0.4"
                strokeWidth="1.2"
              />
              <text
                x={cx}
                y="88"
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="14"
                fontWeight="600"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {n.title}
              </text>
              <text
                x={cx}
                y="110"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="12"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {n.sub}
              </text>
            </g>
          )
        })}

        {/* 浏览器 → 服务层：虚线箭头 */}
        {ARCH_BROWSER.map((n) => {
          const cx = n.x + n.w / 2
          return (
            <line
              key={`b2s-${n.title}`}
              x1={cx}
              y1="140"
              x2={cx}
              y2="212"
              stroke="#22d3ee"
              strokeOpacity="0.55"
              strokeWidth="1.4"
              strokeDasharray="5 5"
              markerEnd="url(#archArrow)"
            />
          )
        })}

        {/* ---------- 服务层容器 ---------- */}
        <rect
          x="160"
          y="220"
          width="820"
          height="150"
          rx="14"
          fill="#080d1a"
          stroke="url(#archGrad)"
          strokeOpacity="0.45"
          strokeWidth="1.3"
        />
        <text
          x="182"
          y="248"
          fill="#e2e8f0"
          fontSize="13"
          fontWeight="600"
          fontFamily="ui-sans-serif, system-ui, sans-serif"
        >
          Next.js API Routes
        </text>
        <text
          x="316"
          y="248"
          fill="#64748b"
          fontSize="11.5"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          pages/api/* · Vercel Functions · region hkg1
        </text>

        {ARCH_APIS.map((api, i) => {
          const row = i < 4 ? 0 : 1
          const col = i < 4 ? i : i - 4
          const x = ARCH_API_CHIP.x + col * (ARCH_API_CHIP.w + ARCH_API_CHIP.gap)
          const y = row === 0 ? 262 : 312
          return (
            <g key={api}>
              <rect
                x={x}
                y={y}
                width={ARCH_API_CHIP.w}
                height={ARCH_API_CHIP.h}
                rx="8"
                fill="#0d1428"
                stroke="#a78bfa"
                strokeOpacity="0.4"
                strokeWidth="1"
              />
              <text
                x={x + ARCH_API_CHIP.w / 2}
                y={y + 22}
                textAnchor="middle"
                fill="#cbd5e1"
                fontSize="11.5"
                fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              >
                {api}
              </text>
            </g>
          )
        })}

        {/* 服务层 → 外部服务层：虚线箭头 */}
        {ARCH_EXTERNAL.map((n) => {
          const cx = n.x + n.w / 2
          return (
            <line
              key={`s2e-${n.title}`}
              x1={cx}
              y1="374"
              x2={cx}
              y2="410"
              stroke="#a78bfa"
              strokeOpacity="0.55"
              strokeWidth="1.4"
              strokeDasharray="5 5"
              markerEnd="url(#archArrowAlt)"
            />
          )
        })}

        {/* ---------- 外部服务层节点 ---------- */}
        {ARCH_EXTERNAL.map((n) => {
          const cx = n.x + n.w / 2
          return (
            <g key={`ext-${n.title}`}>
              <rect
                x={n.x}
                y="418"
                width={n.w}
                height="84"
                rx="12"
                fill="#0a1122"
                stroke="#38bdf8"
                strokeOpacity="0.32"
                strokeWidth="1.2"
              />
              <text
                x={cx}
                y="452"
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="12.5"
                fontWeight="600"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {n.title}
              </text>
              <text
                x={cx}
                y="474"
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10.5"
                fontFamily="ui-sans-serif, system-ui, sans-serif"
              >
                {n.sub}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  </motion.div>
)

/* ============================================================
   页面
   ============================================================ */

const TechPage: NextPage = () => {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#040711] text-slate-100">
      <Nav active="tech" />

      {/* 网格底纹 */}
      <div
        aria-hidden
        className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_50%_0%,#000_10%,transparent_72%)]"
      />
      {/* 顶部极光 */}
      <div
        aria-hidden
        className="animate-pulse-glow pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(34,211,238,0.13),transparent_62%)] blur-2xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[12%] h-[320px] w-[420px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(167,139,250,0.11),transparent_65%)] blur-2xl"
      />

      <main className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-[72px] sm:px-8">
        {/* ============ HERO ============ */}
        <section className="flex flex-col items-center py-10 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.86, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="glass relative mb-7 overflow-hidden rounded-full px-4 py-2"
          >
            <div
              aria-hidden
              className="animate-beam pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-cyan-300/15 to-transparent"
            />
            <span className="relative flex items-center gap-2.5 text-xs tracking-widest text-slate-300">
              <Server className="h-4 w-4 text-cyan-300" />
              弘识智教 · AIMOOC
              <span className="h-3 w-px bg-white/15" />
              <span className="font-mono text-cyan-300/80">TECH STACK</span>
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.21, 1.02, 0.73, 1] }}
            className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl md:text-6xl"
          >
            <span className="text-gradient-cyan-violet text-glow-cyan">技术栈</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-5 max-w-2xl text-base text-slate-400 sm:text-lg"
          >
            一台跑在 Serverless 上的 AI 教室
            <span className="ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[3px] bg-cyan-300 align-middle animate-caret" />
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-7 flex flex-wrap items-center justify-center gap-2"
          >
            {[
              'Next.js 14',
              'TypeScript 5',
              'Tailwind 3',
              'framer-motion 9',
              'Vercel Serverless',
            ].map((v) => (
              <span
                key={v}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 font-mono text-[11px] text-slate-400 transition-colors duration-300 hover:border-cyan-400/30 hover:text-cyan-300"
              >
                {v}
              </span>
            ))}
          </motion.div>
        </section>

        {/* ============ 技术选型卡片 ============ */}
        <section className="py-14">
          <SectionTitle
            index="01"
            title="技术选型"
            desc="每一项选型都服务于同一个目标：让一条 B 站链接在几十秒内变成一堂可交互、可听讲、可追踪的 AI 课堂。"
          />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TECH_STACK.map((item, i) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={item.name}
                  initial={{ opacity: 0, y: 26 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{
                    duration: 0.5,
                    delay: (i % 3) * 0.08,
                    ease: [0.21, 1.02, 0.73, 1],
                  }}
                  className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors duration-300 hover:border-cyan-400/30"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-400/[0.07] opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
                  />

                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/[0.07]">
                      <Icon className="h-[18px] w-[18px] text-cyan-300" />
                    </span>
                    <span className="rounded-md border border-white/[0.06] bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-slate-500">
                      {item.version}
                    </span>
                  </div>

                  <h3 className="mt-4 text-[15px] font-semibold text-slate-100">
                    {item.name}
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-400">
                    {item.desc}
                  </p>

                  <span className="mt-4 inline-flex items-center rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-2.5 py-0.5 text-[10.5px] text-violet-300">
                    {item.category}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </section>

        {/* ============ 架构图 ============ */}
        <section className="py-14">
          <SectionTitle
            index="02"
            title="系统架构"
            desc="浏览器只负责渲染与交互，全部重活交给同构的 API Routes；无状态函数天然适配 Serverless 部署。"
          />
          <ArchitectureDiagram />
        </section>

        {/* ============ 数据流 ============ */}
        <section className="py-14">
          <SectionTitle
            index="03"
            title="数据流"
            desc="从一条链接到一堂完整课程，六步流水线贯穿字幕、课件、可视化、题目与语音。"
          />

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {FLOW_STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="animate-msg-in relative rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors duration-300 hover:border-cyan-400/30"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-cyan-400/25 bg-cyan-400/[0.08] font-mono text-[11px] text-cyan-300">
                    {i + 1}
                  </span>
                  <h3 className="text-[14px] font-semibold text-slate-100">
                    {step.title}
                  </h3>
                </div>

                <ul className="mt-3 space-y-1">
                  {step.apis.map((api) => (
                    <li
                      key={api}
                      className="font-mono text-[11px] text-cyan-300/85"
                    >
                      {api}
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-start gap-1.5 border-t border-white/[0.06] pt-3">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-violet-300" />
                  <span className="text-[12px] leading-relaxed text-slate-400">
                    {step.output}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* ============ 目录结构 ============ */}
        <section className="py-14">
          <SectionTitle
            index="04"
            title="目录结构"
            desc="以功能域切分的目录约定：页面、组件、Hooks、核心库各自独立，改动不会外溢。"
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.21, 1.02, 0.73, 1] }}
            className="glass-strong overflow-hidden rounded-2xl border border-white/[0.06]"
          >
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
              <Terminal className="h-4 w-4 text-cyan-300" />
              <span className="font-mono text-xs text-slate-400">AIMOOC/</span>
              <span className="ml-auto font-mono text-[10.5px] text-slate-600">
                tree -L 2
              </span>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <pre className="px-5 py-5 font-mono text-[12px] leading-[2]">
                {DIR_TREE.map((row) => (
                  <span key={row.dir} className="block whitespace-pre">
                    <span className="text-cyan-300">{row.dir.padEnd(12, ' ')}</span>
                    <span className="text-slate-500">{row.items}</span>
                  </span>
                ))}
              </pre>
            </div>
          </motion.div>
        </section>

        {/* ============ API 表格 ============ */}
        <section className="py-14">
          <SectionTitle
            index="05"
            title="API 路由"
            desc="所有能力都以 Next.js API Routes 暴露，前端只与这一层对话，外部服务永不下沉到浏览器。"
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease: [0.21, 1.02, 0.73, 1] }}
            className="glass-strong overflow-hidden rounded-2xl border border-white/[0.06]"
          >
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      方法
                    </th>
                    <th className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      路径
                    </th>
                    <th className="px-5 py-3.5 font-mono text-[11px] font-medium uppercase tracking-wider text-slate-500">
                      作用
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {API_ROWS.map((row) => (
                    <tr
                      key={`${row.method}-${row.path}`}
                      className="border-b border-white/[0.04] transition-colors duration-200 last:border-b-0 hover:bg-white/[0.03]"
                    >
                      <td className="px-5 py-3 align-top">
                        <span
                          className={cn(
                            'inline-block rounded-md px-2 py-0.5 font-mono text-[10.5px] font-medium',
                            row.method === 'POST'
                              ? 'border border-cyan-400/25 bg-cyan-400/[0.09] text-cyan-300'
                              : 'border border-violet-400/25 bg-violet-400/[0.09] text-violet-300'
                          )}
                        >
                          {row.method}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 align-top font-mono text-[12px] text-slate-200">
                        {row.path}
                      </td>
                      <td className="px-5 py-3 align-top text-[13px] leading-relaxed text-slate-400">
                        {row.purpose}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </section>

        {/* ============ 部署与环境变量 ============ */}
        <section className="py-14">
          <SectionTitle
            index="06"
            title="部署与环境变量"
            desc="全链路无状态，代码推送即可上线；唯一的硬性依赖只有一个 API Key。"
          />

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors duration-300 hover:border-cyan-400/30 lg:col-span-1"
            >
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-cyan-300" />
                <h3 className="text-[15px] font-semibold text-slate-100">部署形态</h3>
              </div>
              <ul className="mt-3.5 space-y-2.5 text-[13px] leading-relaxed text-slate-400">
                <li className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                  Serverless 无状态函数，实例可随时伸缩与销毁
                </li>
                <li className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                  直接推送 Vercel 即可部署，无需自建服务器
                </li>
                <li className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                  region 锁定 hkg1，贴近 B 站接口与国内访问
                </li>
                <li className="flex gap-2">
                  <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-cyan-300" />
                  会话与学习数据外置到 Supabase，函数可随意重建
                </li>
              </ul>

              <div className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.06] px-3 py-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-pulse-glow absolute inline-flex h-full w-full rounded-full bg-emerald-400" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[12px] text-emerald-300/90">
                  就绪：Serverless Functions
                </span>
                <Activity className="ml-auto h-3.5 w-3.5 text-emerald-300/70" />
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.55, delay: 0.08 }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-colors duration-300 hover:border-cyan-400/30 lg:col-span-2"
            >
              <div className="mb-4 flex flex-wrap items-center gap-2.5">
                <Code2 className="h-4 w-4 text-cyan-300" />
                <h3 className="text-[15px] font-semibold text-slate-100">
                  环境变量
                </h3>
                <span className="rounded-full border border-cyan-400/25 bg-cyan-400/[0.09] px-2.5 py-0.5 text-[10.5px] text-cyan-300">
                  必需
                </span>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 text-[10.5px] text-slate-400">
                  可选
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ENV_VARS.map((v) => (
                  <div
                    key={v.name}
                    className={cn(
                      'rounded-xl border p-3 transition-colors duration-300',
                      v.required
                        ? 'border-cyan-400/25 bg-cyan-400/[0.05] hover:border-cyan-400/40'
                        : 'border-white/[0.06] bg-white/[0.02] hover:border-violet-400/30'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-[12px] text-slate-200">
                        {v.name}
                      </code>
                      <span
                        className={cn(
                          'ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                          v.required
                            ? 'bg-cyan-400/[0.12] text-cyan-300'
                            : 'bg-white/[0.05] text-slate-500'
                        )}
                      >
                        {v.required ? '必需' : '可选'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-slate-500">
                      {v.desc}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ============ 页脚 ============ */}
        <footer className="border-t border-white/[0.06] pt-8 text-center">
          <p className="text-xs text-slate-600">
            弘识智教 AIMOOC · Next.js 14 + TypeScript + Tailwind CSS ·
            Serverless on Vercel
          </p>
        </footer>
      </main>
    </div>
  )
}

export default TechPage
