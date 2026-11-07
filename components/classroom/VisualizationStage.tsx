import { FlaskConical, Wand2, RefreshCw, Loader2, AlertTriangle } from 'lucide-react'
import type { UseVisualizeResult } from '~/hooks/useVisualize'

interface VisualizationStageProps {
  viz: UseVisualizeResult
  onRegenerate?: () => void
}

/** 可视化实验舞台：AI 生成的自包含交互页面（沙箱 iframe 渲染） */
export function VisualizationStage({ viz, onRegenerate }: VisualizationStageProps) {
  // 未生成状态
  if (!viz.html && !viz.streaming && !viz.error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="relative">
          <div className="animate-pulse-glow absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/15 to-violet-500/15">
            <FlaskConical className="h-9 w-9 text-cyan-300" />
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-100">生成本课专属交互实验</h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
            AI 将分析视频知识点，为你现场构建一个可动手操作的可视化实验
            —— 调参数、看变化、做类比，比看视频更能建立直觉。
          </p>
        </div>
        <button
          onClick={() => onRegenerate?.()}
          className="flex h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-600 px-7 text-[15px] font-semibold text-white shadow-xl shadow-cyan-500/25 transition-transform hover:scale-105 active:scale-95"
        >
          <Wand2 className="h-[18px] w-[18px]" />
          开始生成实验
        </button>
      </div>
    )
  }

  // 流式生成中
  if (viz.streaming) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span className="animate-ping absolute inset-0 rounded-full bg-violet-400/20" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl border border-violet-400/25 bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15">
            <Loader2 className="h-9 w-9 animate-spin text-violet-300" />
          </div>
        </div>
        <div className="w-64">
          <p className="text-sm font-medium text-slate-200">{viz.progress || '正在生成实验…'}</p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100/10">
            <div className="h-full animate-pulse rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" style={{ width: '60%' }} />
          </div>
          <p className="mt-3 text-[11px] text-slate-600">
            交互实验由 AI 现场编写，通常需要 20-60 秒，生成一次后会缓存
          </p>
        </div>
      </div>
    )
  }

  // 失败
  if (viz.error && !viz.html) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-400/10">
          <AlertTriangle className="h-7 w-7 text-rose-300" />
        </div>
        <div>
          <p className="text-[15px] font-medium text-slate-200">实验生成失败</p>
          <p className="mt-1.5 max-w-sm text-sm text-slate-500">{viz.error}</p>
        </div>
        <button
          onClick={() => onRegenerate?.()}
          className="flex h-11 items-center gap-2 rounded-xl bg-slate-100/[0.06] px-5 text-sm text-slate-200 transition-colors hover:bg-slate-100/[0.12]"
        >
          <RefreshCw className="h-4 w-4" />
          重试
        </button>
      </div>
    )
  }

  // 渲染生成的实验
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-violet-400/20 bg-[#050914]">
        <iframe
          srcDoc={viz.html as string}
          sandbox="allow-scripts allow-forms allow-popups"
          title="AI 生成的可视化实验"
          className="h-full w-full border-0"
        />
        <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-violet-400/15 px-2.5 py-1 text-[10.5px] text-violet-300 backdrop-blur-md">
          <Wand2 className="mr-1 inline h-3 w-3" />
          AI 生成 · 沙箱运行
        </div>
      </div>
      <div className="flex items-center justify-between px-1 py-2.5">
        <p className="text-[11px] text-slate-600">实验内组件可直接交互</p>
        <button
          onClick={() => onRegenerate?.()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] text-slate-400 transition-colors hover:bg-slate-100/[0.06] hover:text-slate-200"
        >
          <RefreshCw className="h-3 w-3" />
          重新生成
        </button>
      </div>
    </div>
  )
}
