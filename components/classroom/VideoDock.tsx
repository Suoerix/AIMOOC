import { useEffect, useRef, useState } from 'react'
import { Play, Pause, Maximize2, Loader2 } from 'lucide-react'
import type { VideoInfo } from '~/lib/types'
import { cn } from '~/lib/utils'

interface VideoDockProps {
  videoInfo: VideoInfo | null
  loading: boolean
  videoRef: React.RefObject<HTMLVideoElement>
  onTimeUpdate: (time: number) => void
  onJumpRequest?: number | null
  onJumpHandled?: () => void
}

/** 轻量视频播放器（作为课堂的辅助信息源，不再作为主体） */
export function VideoDock({
  videoInfo,
  loading,
  videoRef,
  onTimeUpdate,
  onJumpRequest,
  onJumpHandled,
}: VideoDockProps) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [waiting, setWaiting] = useState(true)
  const barRef = useRef<HTMLDivElement>(null)

  // 外部跳转请求（来自课件/助教/测验）
  useEffect(() => {
    if (onJumpRequest != null && videoRef.current) {
      videoRef.current.currentTime = Math.max(0, onJumpRequest)
      videoRef.current
        .play()
        .then(() => setPlaying(true))
        .catch(() => {})
      onJumpHandled?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onJumpRequest])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      v.play().catch(() => {})
      setPlaying(true)
    } else {
      v.pause()
      setPlaying(false)
    }
  }

  const seekByEvent = (e: React.MouseEvent) => {
    const v = videoRef.current
    const bar = barRef.current
    if (!v || !bar || !duration) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    v.currentTime = ratio * duration
  }

  const fmt = (s: number) =>
    isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00'

  if (!videoInfo && !loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-500">
        视频加载失败，可先使用课件与实验继续学习
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative flex-1 overflow-hidden rounded-xl bg-black">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/70 text-slate-300">
            <Loader2 className="h-7 w-7 animate-spin text-cyan-400" />
            <p className="text-xs">正在接入视频流…</p>
          </div>
        )}
        <video
          ref={videoRef}
          src={videoInfo?.embedUrl || undefined}
          className="h-full w-full object-contain"
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime
            setProgress(t)
            onTimeUpdate(t)
          }}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration)
            setWaiting(false)
          }}
          onWaiting={() => setWaiting(true)}
          onPlaying={() => {
            setWaiting(false)
            setPlaying(true)
          }}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          playsInline
          controls={false}
        />
        {/* 居中大播放按钮 */}
        {!playing && !loading && (
          <button
            onClick={togglePlay}
            className="group absolute inset-0 flex items-center justify-center"
            aria-label="播放"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur-md transition-transform group-hover:scale-110">
              <Play className="ml-1 h-7 w-7 text-white" fill="currentColor" />
            </span>
          </button>
        )}
        {waiting && playing && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
          </div>
        )}
      </div>

      {/* 视频信息 + 控制条 */}
      <div className="mt-3 space-y-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-100">
            {videoInfo?.title || '正在加载课程…'}
          </p>
          {videoInfo?.owner && (
            <p className="mt-0.5 truncate text-[11px] text-slate-500">
              UP 主：{videoInfo.owner.name}
            </p>
          )}
        </div>

        <div
          ref={barRef}
          onClick={seekByEvent}
          className="group relative h-2 cursor-pointer rounded-full bg-slate-100/10"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-400"
            style={{ width: duration ? `${(progress / duration) * 100}%` : 0 }}
          />
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
            style={{ left: duration ? `calc(${(progress / duration) * 100}% - 7px)` : 0 }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlay}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-200 transition-colors hover:bg-slate-100/[0.12]"
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              {fmt(progress)} / {fmt(duration)}
            </span>
          </div>
          <button
            onClick={() => videoRef.current?.requestFullscreen?.()}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100/[0.06] text-slate-400 transition-colors hover:bg-slate-100/[0.12]"
            aria-label="全屏"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
