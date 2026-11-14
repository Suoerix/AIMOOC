import { NextPage } from 'next'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  FlaskConical,
  BookOpen,
  PlayCircle,
  GraduationCap,
  ChevronUp,
  MessageCircle,
  Tv,
  StickyNote,
  X,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import Link from 'next/link'
import BilibiliLogin from '~/components/BilibiliLogin'
import { extractUrl, extractPage } from '~/utils/extractUrl'
import { getVideoInfo } from '~/lib/bilibili/getVideoInfo'
import { getBiliVideo } from '~/lib/bilibili/getVideo'
import { getBiliSubtitles } from '~/lib/bilibili/getSubtitles'
import { getBiliCookie } from '~/lib/bilibili/auth'
import { VideoService, VideoInfo, SubtitleData } from '~/lib/types'
import type { TranscriptItem } from '~/lib/video/types'
import TranscriptPanel from '~/components/classroom/TranscriptPanel'
import { useCourseware } from '~/hooks/useCourseware'
import { useVisualize } from '~/hooks/useVisualize'
import { useQuiz } from '~/hooks/useQuiz'
import { useTTS } from '~/hooks/useTTS'
import { CoursewareView } from '~/components/classroom/CoursewareView'
import { VideoDock } from '~/components/classroom/VideoDock'
import { VisualizationStage } from '~/components/classroom/VisualizationStage'
import { TeachingAssistant, newMsgId, TAMessage } from '~/components/classroom/TeachingAssistant'
import { AuthModal } from '~/components/auth/AuthModal'
import { useAuth } from '~/lib/supabase/auth-context'
import { saveCourse, saveNote } from '~/lib/history'
import { cn } from '~/lib/utils'

type StageTab = 'viz' | 'slides' | 'video'

const PRAISE = ['答得漂亮！', '非常好，就是这么理解！', '完全正确，你已经掌握了！', '很棒，继续保持这个节奏！']
const ENCOURAGE = [
  '别灰心，看看解析再回视频确认一下～',
  '差一点点！再想想关键概念的区别。',
  '没关系，错了才知道哪里要重点看。',
]

const ClassroomPage: NextPage = () => {
  const router = useRouter()
  const { id } = router.query
  const videoRef = useRef<HTMLVideoElement>(null)

  // ===== 视频数据 =====
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSubtitles, setHasSubtitles] = useState(false)
  const videoUrlRef = useRef<string>('')
  const bvidRef = useRef<string>('')
  // ===== 多平台支持 =====
  const [isBili, setIsBili] = useState(true)
  const [manualTranscript, setManualTranscript] = useState<TranscriptItem[] | null>(null)
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false)
  const [transcriptNotice, setTranscriptNotice] = useState<string | undefined>()
  const [embedFrame, setEmbedFrame] = useState<string | null>(null)

  // ===== 教室状态 =====
  const [tab, setTab] = useState<StageTab>('slides')
  const [slideIndex, setSlideIndex] = useState(0)
  const [jumpRequest, setJumpRequest] = useState<number | null>(null)
  const [taThinking, setTaThinking] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false) // 移动端助教抽屉
  const [messages, setMessages] = useState<TAMessage[]>([])
  const [showBiliLogin, setShowBiliLogin] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [authOpen, setAuthOpen] = useState(false)
  const [quota, setQuota] = useState<{ remaining: number; limit: number; tier: string } | null>(null)
  const { user } = useAuth()

  // 今日生成额度（登录用户额度更高）
  useEffect(() => {
    let alive = true
    fetch('/api/quota')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return
        setQuota({ remaining: d.generate.remaining, limit: d.generate.limit, tier: d.tier })
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [user])

  const courseware = useCourseware()
  const viz = useVisualize()
  const quiz = useQuiz()
  const tts = useTTS()

  const pushMessage = useCallback(
    (msg: Omit<TAMessage, 'id'>, speak = false) => {
      const full: TAMessage = { ...msg, id: newMsgId() }
      setMessages((prev) => [...prev, full])
      if (speak && full.content) {
        tts.speak(full.content)
      }
      return full.id
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [tts],
  )

  const pushTa = useCallback(
    (content: string, opts?: { kind?: TAMessage['kind']; time?: number; speak?: boolean }) => {
      return pushMessage({ role: 'ta', kind: opts?.kind || 'text', content, time: opts?.time }, opts?.speak !== false)
    },
    [pushMessage],
  )

  // ===== 学习时长埋点 + 历史入库 =====
  const elapsedRef = useRef(0)

  const reportStudy = useCallback(
    (kind: string) => {
      const sec = Math.round(elapsedRef.current)
      elapsedRef.current = 0
      if (sec < 5) return
      const videoId = bvidRef.current || 'unknown'
      const title = videoInfo?.title || '未命名课程'
      // 上报服务端（用于后台看板）
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          title,
          subject: isBili ? 'B 站视频' : '多平台视频',
          durationSec: sec,
          kind,
        }),
        keepalive: true,
      }).catch(() => {})
      // 写入本地 / 云端学习历史
      saveCourse({
        videoId,
        title,
        subject: isBili ? 'B 站视频' : '多平台视频',
        url: videoUrlRef.current,
        durationSec: sec,
      }).catch(() => {})
    },
    [videoInfo?.title],
  )

  useEffect(() => {
    const timer = window.setInterval(() => {
      elapsedRef.current += 1
      if (elapsedRef.current % 30 === 0) reportStudy('session')
    }, 1000)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') reportStudy('session')
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      reportStudy('leave')
    }
  }, [reportStudy])

  // 进度变化 → 更新历史记录
  useEffect(() => {
    if (!bvidRef.current || !videoInfo?.title) return
    const total = courseware.slides.length
    // 没有课件时不做进度推断（避免一律显示 80%）
    const progress = total > 0 ? Math.min(99, Math.round(((slideIndex + 1) / total) * 80)) : 0
    saveCourse({
      videoId: bvidRef.current,
      title: videoInfo.title,
      subject: isBili ? 'B 站视频' : '多平台视频',
      url: videoUrlRef.current,
      progress,
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideIndex, courseware.slides.length, videoInfo?.title])

  // ===== 课堂笔记 =====
  const handleSaveNote = useCallback(async () => {
    if (!noteDraft.trim()) return
    await saveNote({
      videoId: bvidRef.current || 'general',
      title: videoInfo?.title ? `《${videoInfo.title}》的笔记` : '课堂笔记',
      content: noteDraft.trim(),
    })
    setNoteDraft('')
    setNoteOpen(false)
    toast.success('笔记已保存到「我的笔记」')
  }, [noteDraft, videoInfo?.title])

  // ===== 开场问候（保证助教面板不为空） =====
  const greetedRef = useRef(false)
  useEffect(() => {
    if (greetedRef.current) return
    greetedRef.current = true
    pushTa('你好，我是小识 —— 你的 AI 助教。左侧是这节课的 AI 课件与可视化实验，右边随时可以把问题丢给我。', {
      speak: true,
    })
  }, [pushTa])

  // ===== 加载视频 =====
  useEffect(() => {
    if (!id) return

    // 支持两种入口：localStorage（主页跳转）/ ?url= 直接分享
    let url = ''
    const savedData = localStorage.getItem(`learning_${id}`)
    if (savedData) {
      try {
        url = JSON.parse(savedData).url || ''
      } catch {
        url = ''
      }
    }
    if (!url && typeof router.query.url === 'string') url = router.query.url
    if (!url) {
      toast.error('未找到课程信息，即将返回首页')
      setTimeout(() => router.push('/'), 1200)
      return
    }

    videoUrlRef.current = url
    setLoading(true)
    ;(async () => {
      try {
        // b23.tv 短链先解析成完整地址
        let realUrl = url
        if (realUrl.includes('b23.tv')) {
          const r = await fetch(`/api/b23tv?url=${encodeURIComponent(realUrl)}`)
          if (r.ok) realUrl = (await r.json()).url || realUrl
        }
        if (realUrl.includes('bilibili.com')) {
          videoUrlRef.current = realUrl
          try {
            localStorage.setItem(`learning_${id}`, JSON.stringify({ url: realUrl, timestamp: Date.now(), config: {} }))
          } catch {
            /* ignore */
          }

          const bvid = extractUrl(realUrl)
          if (!bvid) {
            toast.error('无法解析视频 ID')
            setLoading(false)
            return
          }
          bvidRef.current = bvid
          const page = extractPage(realUrl, new URLSearchParams(realUrl.split('?')[1]))

          const info = await getVideoInfo(bvid)
          setVideoInfo({
            ...info,
            service: VideoService.Bilibili,
            videoId: bvid,
            embedUrl: '',
            page: page ? Number(page) : 1,
          })
          getBiliVideo(realUrl)
            .then((videoUrl: string) => {
              setVideoInfo((prev) => (prev ? { ...prev, embedUrl: videoUrl } : prev))
              setLoading(false)
            })
            .catch(() => setLoading(false))
          const subtitles = await getBiliSubtitles(realUrl)
          setHasSubtitles(subtitles && subtitles.length > 0)
          if (!subtitles || subtitles.length === 0) {
            toast('该视频没有字幕，AI 课件功能需要字幕支持', { icon: '⚠️' })
            pushTa('这个视频暂无字幕，AI 无法直接生成课件与实验。你仍可以观看视频并向我提问～', { speak: true })
          }
        } else {
          // 多平台：统一走 /api/video/resolve（服务端按适配器解析元数据与字幕）
          setIsBili(false)
          videoUrlRef.current = realUrl
          const res = await fetch('/api/video/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: realUrl }),
          })
          if (!res.ok) {
            toast.error('视频解析失败，请检查链接是否支持')
            setLoading(false)
            return
          }
          const data = await res.json()
          const meta = data?.meta || {}
          bvidRef.current = meta.id || 'external'
          setVideoInfo({
            service: VideoService.Bilibili,
            videoId: meta.id || 'external',
            embedUrl: meta.playUrl || '',
            title: meta.title || '外部视频',
            page: 1,
            owner: meta.author ? { name: meta.author, face: '' } : undefined,
          })
          setEmbedFrame(meta.embedUrl || null)
          const transcript: TranscriptItem[] = Array.isArray(data?.transcript) ? data.transcript : []
          if (transcript.length > 0) {
            setManualTranscript(transcript)
            setHasSubtitles(true)
          } else {
            setHasSubtitles(false)
            setTranscriptNotice(data?.notice)
            setShowTranscriptPanel(true)
            const tip =
              data?.notice || '该平台没有公开字幕接口，请手动粘贴字幕文本或上传 SRT/VTT，之后所有 AI 功能均可正常使用。'
            pushTa(tip, { speak: true })
          }
          setLoading(false)
        }
      } catch (error: any) {
        setLoading(false)
        toast.error(error?.message || '视频加载失败')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  // ===== 课件生成（字幕就绪后自动触发一次） =====
  const coursewareStartedRef = useRef(false)
  useEffect(() => {
    if (!id || !hasSubtitles || coursewareStartedRef.current) return
    if (!bvidRef.current) return
    coursewareStartedRef.current = true
    pushTa('正在把这门课改编成课件，稍等片刻…', { kind: 'system', speak: false })
    courseware.generate(
      bvidRef.current,
      videoInfo?.page,
      getBiliCookie(),
      videoInfo?.title,
      manualTranscript || undefined,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSubtitles, id, videoInfo?.page, manualTranscript])

  // ===== 课件完成 → 开场 + 出题 =====
  const introDoneRef = useRef(false)
  useEffect(() => {
    if (introDoneRef.current) return
    if (courseware.streaming || courseware.slides.length === 0) return
    if (!coursewareStartedRef.current) return
    introDoneRef.current = true

    const title = videoInfo?.title || '本节课'
    pushTa(
      `欢迎来到 AI 教室！今天这节课是《${title}》。我已经把视频内容整理成了课件，左侧可以翻阅。想动手玩一玩的话，随时切到「可视化实验」，我来现场给你造一个。现在，先来几道题检验一下理解吧！`,
      { speak: true },
    )
    // 生成互动题
    quiz.generate(bvidRef.current, videoInfo?.page, getBiliCookie(), manualTranscript || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseware.streaming, courseware.slides, videoInfo?.title])

  // ===== 出题完成 → 推送第一题 =====
  const quizPushedRef = useRef<Set<number>>(new Set())
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0)
  useEffect(() => {
    if (quiz.questions.length === 0 || quiz.loading) return
    if (quizPushedRef.current.size > 0) return
    pushTa('第一题来了，选出你认为正确的答案：', { speak: false })
    pushMessage({ role: 'ta', kind: 'quiz', quiz: quiz.questions[0], quizIndex: 0 })
    quizPushedRef.current.add(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.questions, quiz.loading])

  // ===== 答题反馈 + 下一题 =====
  const quizRightRef = useRef(0)
  const handleQuizAnswer = useCallback(
    (correct: boolean, _msgId: string) => {
      const idx = currentQuizIndex
      const total = quiz.questions.length
      const right = quizRightRef.current + (correct ? 1 : 0)
      quizRightRef.current = right
      if (bvidRef.current) {
        saveCourse({
          videoId: bvidRef.current,
          title: videoInfo?.title || '未命名课程',
          subject: isBili ? 'B 站视频' : '多平台视频',
          url: videoUrlRef.current,
          quizRight: right,
          quizTotal: total,
          progress: Math.max(60, Math.round((right / Math.max(1, total)) * 100)),
        }).catch(() => {})
      }
      pushTa(
        correct
          ? PRAISE[idx % PRAISE.length]
          : `${ENCOURAGE[idx % ENCOURAGE.length]}${
              quiz.questions[idx]?.time ? '可以点解析里的「跳回视频」回顾一下。' : ''
            }`,
        { speak: true },
      )
      const next = idx + 1
      if (next < quiz.questions.length) {
        setCurrentQuizIndex(next)
        setTimeout(() => {
          pushTa(`第 ${next + 1} 题：`, { speak: false })
          pushMessage({ role: 'ta', kind: 'quiz', quiz: quiz.questions[next], quizIndex: next })
          quizPushedRef.current.add(next)
        }, 900)
      } else {
        setTimeout(() => {
          pushTa(
            '题目做完啦！接下来推荐你：① 翻左侧课件查漏补缺；② 打开「可视化实验」亲手玩一玩核心概念；③ 有任何疑问随时问我。',
            { speak: true },
          )
        }, 1200)
      }
    },
    [currentQuizIndex, quiz.questions, pushTa, pushMessage],
  )

  // ===== 翻页 → 助教讲解 =====
  const lastSpokenSlideRef = useRef(-1)
  const handleSlideNav = useCallback(
    (index: number) => {
      setSlideIndex(index)
      const slide = courseware.slides[index]
      if (slide && index !== lastSpokenSlideRef.current) {
        lastSpokenSlideRef.current = index
        if (slide.taNote) {
          pushTa(slide.taNote, { time: slide.time ?? undefined, speak: true })
        }
      }
    },
    [courseware.slides, pushTa],
  )

  // ===== 用户提问 =====
  const handleUserAsk = useCallback(
    async (text: string) => {
      setMessages((prev) => [...prev, { id: newMsgId(), role: 'user', content: text }])
      setTaThinking(true)
      setSheetOpen(true)
      try {
        const outline = courseware.slides
          .slice(0, 8)
          .map((s, i) => `${i + 1}. ${s.title}`)
          .join('\n')
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'ta',
            videoTitle: videoInfo?.title,
            outline,
            messages: [{ role: 'user', content: text }],
          }),
        })
        if (!res.ok) throw new Error()
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        let reply = ''
        const msgId = pushMessage({ role: 'ta', content: '' }, false)
        if (reader) {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            reply += decoder.decode(value, { stream: true })
            const r = reply
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, content: r } : m)))
          }
        }
        if (reply.trim()) tts.speak(reply.slice(0, 400))
      } catch {
        pushTa('哎呀，我走神了，再问一次试试？', { speak: false })
      } finally {
        setTaThinking(false)
      }
    },
    [courseware.slides, videoInfo?.title, pushMessage, pushTa, tts],
  )

  // ===== 视频跳转 =====
  const handleJumpVideo = useCallback((time: number) => {
    setJumpRequest(time)
    setTab('video')
    toast.success(`已跳转至 ${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, '0')}`, { icon: '⏱' })
  }, [])

  // ===== 生成交互实验 =====
  const handleGenerateViz = useCallback(() => {
    if (!bvidRef.current) return
    setTab('viz')
    viz.generate(bvidRef.current, {
      pageNumber: videoInfo?.page,
      cookie: getBiliCookie(),
      transcript: manualTranscript || undefined,
    })
    pushTa('收到！我正在为你编写一个专属交互实验，完成后左侧就会展示，记得动手调一调参数～', { speak: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoInfo?.page, viz, pushTa])

  const TABS: { key: StageTab; label: string; icon: typeof FlaskConical; hint?: string }[] = [
    { key: 'viz', label: '可视化实验', icon: FlaskConical },
    { key: 'slides', label: 'AI 课件', icon: BookOpen, hint: courseware.streaming ? '生成中' : undefined },
    { key: 'video', label: '视频', icon: PlayCircle },
  ]

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#040711] text-slate-100">
      {/* ===== 顶栏 ===== */}
      <header className="glass-strong z-30 flex items-center gap-3 px-4 py-2.5 sm:px-5">
        <Link
          href="/"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-300 transition-colors hover:bg-slate-100/[0.12]"
          aria-label="返回首页"
        >
          <ArrowLeft className="h-[18px] w-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/40 to-violet-500/40 text-base">
            <GraduationCap className="h-5 w-5 text-cyan-200" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{videoInfo?.title || 'AI 教室'}</p>
            <p className="truncate text-[11px] text-slate-500">
              {videoInfo?.owner ? `${videoInfo.owner.name} · ` : ''}AI 可视化教学进行中
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
          </span>
          弘识智教
        </div>
        {quota && (
          <span
            className={cn(
              'hidden items-center gap-1 rounded-lg px-2 py-1 text-[11px] md:flex',
              quota.remaining > 0 ? 'bg-white/[0.05] text-slate-400' : 'bg-rose-500/10 text-rose-300',
            )}
            title="AI 生成（课件 / 实验 / 题目）每日额度"
          >
            今日剩余 {quota.remaining}/{quota.limit} 次生成
          </span>
        )}
        {!user && (
          <button
            onClick={() => setAuthOpen(true)}
            className="hidden h-8 items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500/25 to-violet-500/25 px-3 text-[12px] font-medium text-cyan-100 transition-colors hover:from-cyan-500/40 hover:to-violet-500/40 md:flex"
          >
            登录提升额度
          </button>
        )}
        <button
          onClick={() => setNoteOpen((v) => !v)}
          title="记笔记"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-400 transition-colors hover:bg-slate-100/[0.12] hover:text-cyan-300"
          aria-label="记笔记"
        >
          <StickyNote className="h-4 w-4" />
        </button>
        <button
          onClick={() => setShowBiliLogin(true)}
          title="B 站账号（用于获取需要登录的字幕）"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-400 transition-colors hover:bg-slate-100/[0.12] hover:text-cyan-300"
          aria-label="B 站登录"
        >
          <Tv className="h-4 w-4" />
        </button>
        {!isBili && !manualTranscript && (
          <button
            onClick={() => setShowTranscriptPanel(true)}
            className="hidden h-8 items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 text-[12px] font-medium text-amber-200 transition-colors hover:bg-amber-500/25 md:flex"
            title="导入字幕以启用 AI 课件 / 出题 / 可视化"
          >
            导入字幕
          </button>
        )}
      </header>

      {/* B 站登录弹窗（获取字幕增强） */}
      <BilibiliLogin show={showBiliLogin} onClose={() => setShowBiliLogin(false)} />

      {/* 字幕导入弹窗（多平台手动字幕通道） */}
      {showTranscriptPanel && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-[min(94vw,560px)] rounded-2xl">
            <TranscriptPanel
              notice={transcriptNotice}
              onClose={() => setShowTranscriptPanel(false)}
              onApply={(items: TranscriptItem[]) => {
                setManualTranscript(items)
                setHasSubtitles(true)
                setShowTranscriptPanel(false)
                toast.success('字幕已导入，正在生成 AI 课件…')
              }}
            />
          </div>
        </div>
      )}

      {/* 账号登录 */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {/* 记笔记面板 */}
      {noteOpen && (
        <div className="glass-strong absolute left-3 top-[64px] z-[60] w-[min(92vw,360px)] rounded-2xl p-4 shadow-2xl shadow-black/50">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-medium text-slate-200">记下此刻的想法</p>
            <button
              onClick={() => setNoteOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-300"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={5}
            placeholder="这一段我没听懂 / 这个公式原来可以这样理解…"
            className="w-full resize-none rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 text-[13px] leading-relaxed text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
          />
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-slate-600">保存后可在「笔记」页查看</span>
            <button
              onClick={handleSaveNote}
              disabled={!noteDraft.trim()}
              className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 px-4 text-[12.5px] font-medium text-white transition-transform hover:scale-105 disabled:opacity-40"
            >
              保存
            </button>
          </div>
        </div>
      )}

      {/* ===== 主体 ===== */}
      <div className="relative flex min-h-0 flex-1">
        {/* 教学舞台 */}
        <main className="flex min-w-0 flex-1 flex-col p-3 sm:p-4 md:mr-0 md:pr-0">
          {/* Tab 栏 */}
          <div className="mb-3 flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-slate-100/[0.04] p-1.5">
            {TABS.map(({ key, label, icon: Icon, hint }) => (
              <button
                key={key}
                onClick={() => (key === 'viz' && !viz.html && !viz.streaming ? handleGenerateViz() : setTab(key))}
                className={cn(
                  'relative flex h-10 min-w-[104px] flex-1 items-center justify-center gap-1.5 rounded-xl text-[13px] font-medium transition-all sm:min-w-[120px]',
                  tab === key
                    ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-white shadow-inner'
                    : 'text-slate-500 hover:bg-slate-100/[0.05] hover:text-slate-300',
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
                {hint && (
                  <span className="absolute right-2 top-1.5 flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 舞台内容 */}
          <div className="glass min-h-0 flex-1 overflow-hidden rounded-2xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="h-full min-h-0"
              >
                {tab === 'viz' && <VisualizationStage viz={viz} onRegenerate={handleGenerateViz} />}
                {tab === 'slides' && (
                  <CoursewareView
                    slides={courseware.slides}
                    current={slideIndex}
                    streaming={courseware.streaming}
                    onNav={handleSlideNav}
                    onJumpVideo={handleJumpVideo}
                    error={
                      courseware.error ||
                      (!hasSubtitles && !loading && videoInfo
                        ? '该视频没有可用字幕，无法生成 AI 课件。部分视频需登录 B 站后才能获取字幕（点右上角电视图标）。'
                        : null)
                    }
                  />
                )}
                {tab === 'video' && (
                  <div className="scrollbar-thin h-full min-h-0 overflow-y-auto p-3 sm:p-4">
                    {!isBili && embedFrame ? (
                      <div className="flex h-full min-h-0 items-center justify-center">
                        <iframe
                          src={embedFrame}
                          title={videoInfo?.title || '视频'}
                          className="aspect-video h-auto w-full rounded-2xl"
                          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                        />
                      </div>
                    ) : (
                      <VideoDock
                        videoInfo={videoInfo}
                        loading={loading}
                        videoRef={videoRef}
                        onTimeUpdate={() => {}}
                        onJumpRequest={jumpRequest}
                        onJumpHandled={() => setJumpRequest(null)}
                      />
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* ===== 右侧 AI 助教（桌面侧栏 / 移动抽屉共用） ===== */}
        <aside
          className={cn(
            'z-40 flex min-h-0 flex-col border-white/[0.07] bg-[#050a18]/95 backdrop-blur-xl transition-transform duration-300',
            // 桌面：常驻右侧栏
            'md:relative md:flex md:h-auto md:w-[340px] md:translate-y-0 md:border-l md:pb-0 lg:w-[380px]',
            // 移动：底部抽屉
            sheetOpen
              ? 'fixed inset-x-0 bottom-0 h-[62vh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]'
              : 'fixed inset-x-0 bottom-0 hidden h-0 translate-y-full',
          )}
        >
          <TeachingAssistant
            messages={messages}
            quizTotal={quiz.questions.length}
            onQuizAnswer={handleQuizAnswer}
            onJumpVideo={handleJumpVideo}
            onUserAsk={handleUserAsk}
            thinking={taThinking}
            tts={tts}
          />
        </aside>

        {/* 移动端：抽屉收起时的助教悬浮按钮 */}
        <button
          onClick={() => setSheetOpen(true)}
          className={cn(
            'fixed bottom-4 right-4 z-40 flex h-[52px] items-center gap-2 rounded-full bg-gradient-to-r from-cyan-500 to-violet-600 px-5 text-sm font-semibold text-white shadow-xl shadow-cyan-500/30 transition-all active:scale-95',
            'md:hidden',
            sheetOpen && 'pointer-events-none opacity-0',
          )}
        >
          <MessageCircle className="h-5 w-5" />
          AI 助教
        </button>

        {/* 移动端：抽屉展开时的收起按钮 */}
        <button
          onClick={() => setSheetOpen(false)}
          className={cn(
            'absolute right-1/2 top-[calc(38vh+2px)] z-50 flex h-6 translate-x-1/2 items-center gap-1 rounded-full bg-slate-800/90 px-3 text-[10px] text-slate-400 backdrop-blur',
            'md:hidden',
            !sheetOpen && 'hidden',
          )}
        >
          <ChevronUp className="h-3 w-3 rotate-180" />
          收起助教
        </button>
      </div>
    </div>
  )
}

export default ClassroomPage
