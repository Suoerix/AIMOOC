/**
 * AI 教室 · 后台数据看板图表组件（纯手写 SVG / CSS，零图表库依赖）
 *
 * 用法示例：
 *   <AreaTrend data={[{ label: '周一', value: 128 }]} height={200} />
 *   <BarSeries data={[{ label: '数学', value: 320 }]} showAxis />
 *   <RankBars data={[{ label: '一次函数', value: 900, sub: '数学 · 函数' }]} />
 *   <DonutChart data={[{ label: '数学', value: 60, color: '#22d3ee' }]} />
 *   <StatTile label="注册用户" value={12840} delta="+12.4%" icon={<UserIcon />} />
 *
 * 约定：
 * - 全部图形颜色通过 fill / stroke 属性显式指定，不依赖 CSS class（避免被 Tailwind 覆盖成黑色）。
 * - data 为空或全零时不抛错，统一降级为「暂无数据」占位。
 * - 未传 valueFormat 时使用紧凑格式：>= 10000 显示 12.3k，>= 1000000 显示 1.2m。
 */

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { MutableRefObject, PointerEvent as ReactPointerEvent, ReactNode } from 'react'

/** 服务端渲染时退化为 useEffect，避免 React 的 SSR 警告 */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export interface ChartDatum {
  label: string
  value: number
  sub?: string
  color?: string
}

export interface AreaTrendProps {
  data: ChartDatum[]
  height?: number
  color?: string
  valueFormat?: (n: number) => string
  yTicks?: number
}

export interface BarSeriesProps {
  data: ChartDatum[]
  height?: number
  color?: string
  valueFormat?: (n: number) => string
  showAxis?: boolean
}

export interface RankBarsProps {
  data: ChartDatum[]
  valueFormat?: (n: number) => string
  max?: number
  accent?: string
}

export interface DonutChartProps {
  data: ChartDatum[]
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  /** 图例列数：窄容器用 1 列，避免名称被截断 */
  legendColumns?: 1 | 2
}

export interface StatTileProps {
  label: string
  value: string | number
  delta?: string
  hint?: string
  icon?: ReactNode
  accent?: string
}

/* ------------------------------------------------------------------ */
/* 常量与工具                                                          */
/* ------------------------------------------------------------------ */

const AXIS_COLOR = '#64748b'
const GRID_COLOR = 'rgba(148,163,184,0.10)'
const HOVER_COLOR = '#67e8f9'
const DEFAULT_ACCENT = '#22d3ee'
const SECONDARY_ACCENT = '#a78bfa'
const PALETTE = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24', '#f472b6', '#60a5fa']

/** 紧凑数值格式：>= 10000 -> 12.3k，>= 1000000 -> 1.2m */
function defaultFormat(n: number): string {
  if (!isFiniteNumber(n)) return '0'
  const abs = Math.abs(n)
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}m`
  if (abs >= 10000) return `${(n / 1000).toFixed(1)}k`
  return String(Math.round(n * 100) / 100)
}

/** NaN / Infinity 安全判定 */
function isFiniteNumber(n: number): boolean {
  return typeof n === 'number' && !isNaN(n) && isFinite(n)
}

/** 把 #rrggbb 转成 rgba()，用于卡片徽章的半透明底色 */
function withAlpha(hex: string, alpha: number): string {
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return hex
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 把最大值向上取整到 1 / 2 / 2.5 / 5 / 10 × 10^n，让坐标轴刻度好看 */
function niceMax(value: number): number {
  if (!isFiniteNumber(value) || value <= 0) return 1
  const exp = Math.floor(Math.log(value) / Math.LN10)
  const base = Math.pow(10, exp)
  const frac = value / base
  const nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 2.5 ? 2.5 : frac <= 5 ? 5 : 10
  return nice * base
}

function round2(v: number): number {
  return Math.round(v * 100) / 100
}

/** 求数组最大值（全零 / 空数组返回 0），避免 Math.max.apply 的参数上限问题 */
function maxOf(values: number[]): number {
  let max = 0
  for (let i = 0; i < values.length; i++) {
    if (values[i] > max) max = values[i]
  }
  return max
}

interface Point {
  x: number
  y: number
}

/**
 * Catmull-Rom 转三次贝塞尔，得到平滑折线路径。
 * 首尾端点做钳制，避免曲线在边界处甩出去。
 */
function smoothPath(points: Point[], tension = 0.85): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${round2(points[0].x)} ${round2(points[0].y)}`

  let d = `M ${round2(points[0].x)} ${round2(points[0].y)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[0]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i + 2 < points.length ? points[i + 2] : points[points.length - 1]
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension
    d += ` C ${round2(c1x)} ${round2(c1y)}, ${round2(c2x)} ${round2(c2y)}, ${round2(p2.x)} ${round2(p2.y)}`
  }
  return d
}

/** 只在底部带圆角的柱子路径 */
function barPath(x: number, y: number, w: number, h: number, r: number): string {
  const height = Math.max(0, h)
  if (height <= 0.5) return `M ${round2(x)} ${round2(y + height)} L ${round2(x + w)} ${round2(y + height)}`
  const rr = Math.min(r, w / 2, height)
  return [
    `M ${round2(x)} ${round2(y)}`,
    `L ${round2(x + w)} ${round2(y)}`,
    `L ${round2(x + w)} ${round2(y + height - rr)}`,
    `Q ${round2(x + w)} ${round2(y + height)} ${round2(x + w - rr)} ${round2(y + height)}`,
    `L ${round2(x + rr)} ${round2(y + height)}`,
    `Q ${round2(x)} ${round2(y + height)} ${round2(x)} ${round2(y + height - rr)}`,
    'Z',
  ].join(' ')
}

/** 监听容器宽度，让 SVG 以 1:1 像素绘制（viewBox 宽度 = 实际渲染宽度），文字不会被拉伸 */
function useContainerWidth(fallback = 640): { ref: MutableRefObject<HTMLDivElement | null>; width: number } {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(fallback)

  useIsomorphicLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const update = (): void => {
      const w = el.getBoundingClientRect().width
      if (w > 0) setWidth(w)
    }

    update()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update)
      return () => window.removeEventListener('resize', update)
    }

    const ro = new ResizeObserver(() => update())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return { ref, width }
}

/** 生成页面内唯一的 SVG id（React 18 useId，SSR 安全；去掉特殊字符避免 url(#id) 解析问题） */
function useSvgId(prefix: string): string {
  const raw = useId()
  const id = raw.replace(/[^a-zA-Z0-9]/g, '')
  return `${prefix}-${id}`
}

function EmptyState({ height, label = '暂无数据' }: { height: number; label?: string }): JSX.Element {
  return (
    <div
      className="flex items-center justify-center rounded-xl border border-dashed border-white/[0.08] text-xs text-slate-500"
      style={{ height }}
    >
      {label}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* AreaTrend                                                           */
/* ------------------------------------------------------------------ */

export function AreaTrend({
  data,
  height = 180,
  color = DEFAULT_ACCENT,
  valueFormat = defaultFormat,
  yTicks = 4,
}: AreaTrendProps): JSX.Element {
  const { ref, width } = useContainerWidth(640)
  const gradId = useSvgId('area-grad')
  const glowId = useSvgId('area-glow')
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const padLeft = 42
  const padRight = 14
  const padTop = 16
  const padBottom = 26
  const plotW = Math.max(1, width - padLeft - padRight)
  const plotH = Math.max(1, height - padTop - padBottom)
  const baseline = padTop + plotH

  const values = data.map((d) => (isFiniteNumber(d.value) ? d.value : 0))
  const scaleMax = niceMax(maxOf(values))
  const count = values.length
  const step = count > 1 ? plotW / (count - 1) : 0

  const points: Point[] = values.map((v, i) => ({
    x: count > 1 ? padLeft + i * step : padLeft + plotW / 2,
    y: padTop + plotH * (1 - Math.min(1, Math.max(0, v / scaleMax))),
  }))

  const linePath = smoothPath(points)
  const areaPath =
    points.length > 1
      ? `${linePath} L ${round2(points[points.length - 1].x)} ${round2(baseline)} L ${round2(points[0].x)} ${round2(
          baseline,
        )} Z`
      : ''

  const ticks = Math.max(1, Math.floor(yTicks))
  const gridLines: number[] = []
  for (let i = 0; i <= ticks; i++) gridLines.push((scaleMax / ticks) * i)

  const showEveryLabel = count <= 6
  const midIndex = Math.floor((count - 1) / 2)
  const labelIndexes: number[] = []
  if (showEveryLabel) {
    for (let i = 0; i < count; i++) labelIndexes.push(i)
  } else {
    const picked = [0, midIndex, count - 1]
    for (let i = 0; i < picked.length; i++) {
      const idx = picked[i]
      if (idx >= 0 && idx < count && labelIndexes.indexOf(idx) === -1) labelIndexes.push(idx)
    }
  }

  const handleMove = (e: ReactPointerEvent<SVGSVGElement>): void => {
    if (count === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const scale = width / rect.width
    const x = (e.clientX - rect.left) * scale
    const ratio = count > 1 ? (x - padLeft) / step : 0
    const idx = Math.round(ratio)
    setHoverIndex(idx >= 0 && idx < count ? idx : null)
  }

  if (count === 0) return <EmptyState height={height} />

  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null
  const hoverDatum = hoverIndex !== null ? data[hoverIndex] : null

  return (
    <div ref={ref} className="relative w-full">
      <svg
        viewBox={`0 0 ${round2(width)} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className="block w-full"
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.38" />
            <stop offset="55%" stopColor={color} stopOpacity="0.12" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <filter id={glowId} x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 横向网格线 + y 轴刻度 */}
        {gridLines.map((tick) => {
          const y = baseline - (tick / scaleMax) * plotH
          return (
            <g key={`grid-${tick}`}>
              <line
                x1={padLeft}
                y1={round2(y)}
                x2={round2(width - padRight)}
                y2={round2(y)}
                stroke={GRID_COLOR}
                strokeWidth={1}
              />
              <text x={padLeft - 8} y={round2(y + 3.5)} textAnchor="end" fontSize={10.5} fill={AXIS_COLOR}>
                {valueFormat(tick)}
              </text>
            </g>
          )
        })}

        {/* 渐变面积 */}
        {areaPath ? <path d={areaPath} fill={`url(#${gradId})`} stroke="none" /> : null}

        {/* 平滑折线 */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-500"
        />

        {/* 最后一个数据点的发光圆点 */}
        {points.length > 0 ? (
          <g>
            <circle
              cx={round2(points[points.length - 1].x)}
              cy={round2(points[points.length - 1].y)}
              r={4.5}
              fill={color}
              filter={`url(#${glowId})`}
              className="transition-all duration-500"
            />
            <circle
              cx={round2(points[points.length - 1].x)}
              cy={round2(points[points.length - 1].y)}
              r={2}
              fill="#e2e8f0"
            />
          </g>
        ) : null}

        {/* hover 参考线 + 高亮点 */}
        {hoverPoint ? (
          <g>
            <line
              x1={round2(hoverPoint.x)}
              y1={padTop}
              x2={round2(hoverPoint.x)}
              y2={round2(baseline)}
              stroke={HOVER_COLOR}
              strokeWidth={1}
              strokeDasharray="3 3"
              opacity={0.55}
            />
            <circle cx={round2(hoverPoint.x)} cy={round2(hoverPoint.y)} r={4} fill={HOVER_COLOR} />
          </g>
        ) : null}

        {/* x 轴标签：数据点多时只显示首 / 中 / 末 */}
        {labelIndexes.map((i) => {
          const p = points[i]
          if (!p) return null
          const isFirst = i === 0
          const isLast = i === count - 1
          const anchor = isFirst ? 'start' : isLast ? 'end' : 'middle'
          const x = isFirst ? padLeft : isLast ? width - padRight : p.x
          return (
            <text
              key={`x-${i}`}
              x={round2(x)}
              y={height - 8}
              textAnchor={anchor}
              fontSize={10.5}
              fill={AXIS_COLOR}
            >
              {data[i].label}
            </text>
          )
        })}
      </svg>

      {/* hover tooltip */}
      {hoverPoint && hoverDatum ? (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[130%] whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/90 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur"
          style={{
            left: `${(hoverPoint.x / width) * 100}%`,
            top: `${(hoverPoint.y / height) * 100}%`,
          }}
        >
          <div className="text-slate-400">{hoverDatum.label}</div>
          <div className="font-semibold text-slate-100">{valueFormat(hoverDatum.value)}</div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* BarSeries                                                           */
/* ------------------------------------------------------------------ */

export function BarSeries({
  data,
  height = 180,
  color = SECONDARY_ACCENT,
  valueFormat = defaultFormat,
  showAxis = true,
}: BarSeriesProps): JSX.Element {
  const { ref, width } = useContainerWidth(640)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const count = data.length
  const padLeft = showAxis ? 38 : 10
  const padRight = 10
  const padTop = 20
  const rotateLabels = count > 8 || data.some((d) => d.label.length > 5)
  const padBottom = showAxis ? (rotateLabels ? 46 : 26) : 10

  const plotW = Math.max(1, width - padLeft - padRight)
  const plotH = Math.max(1, height - padTop - padBottom)
  const baseline = padTop + plotH

  const values = data.map((d) => (isFiniteNumber(d.value) ? d.value : 0))
  const scaleMax = niceMax(maxOf(values))
  const step = count > 0 ? plotW / count : plotW
  const barW = Math.max(2, step * 0.68)

  const ticks = 4
  const gridLines: number[] = []
  for (let i = 0; i <= ticks; i++) gridLines.push((scaleMax / ticks) * i)

  const showValues = count > 0 && count <= 12

  if (count === 0) return <EmptyState height={height} />

  return (
    <div ref={ref} className="relative w-full">
      <svg
        viewBox={`0 0 ${round2(width)} ${height}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        className="block w-full"
      >
        {/* 网格线 + y 轴刻度 */}
        {showAxis
          ? gridLines.map((tick) => {
              const y = baseline - (tick / scaleMax) * plotH
              return (
                <g key={`bgrid-${tick}`}>
                  <line
                    x1={padLeft}
                    y1={round2(y)}
                    x2={round2(width - padRight)}
                    y2={round2(y)}
                    stroke={GRID_COLOR}
                    strokeWidth={1}
                  />
                  <text x={padLeft - 8} y={round2(y + 3.5)} textAnchor="end" fontSize={10.5} fill={AXIS_COLOR}>
                    {valueFormat(tick)}
                  </text>
                </g>
              )
            })
          : null}

        {/* 柱子 */}
        {data.map((d, i) => {
          const value = values[i]
          const h = Math.min(1, Math.max(0, value / scaleMax)) * plotH
          const x = padLeft + i * step + (step - barW) / 2
          const y = baseline - h
          const isHover = hoverIndex === i
          const fill = isHover ? HOVER_COLOR : color
          return (
            <g
              key={`bar-${d.label}-${i}`}
              onPointerEnter={() => setHoverIndex(i)}
              onPointerLeave={() => setHoverIndex((cur) => (cur === i ? null : cur))}
            >
              {/* 透明热区，方便鼠标命中 */}
              <rect
                x={round2(padLeft + i * step)}
                y={padTop}
                width={round2(step)}
                height={round2(plotH)}
                fill="transparent"
              />
              <path
                d={barPath(x, y, barW, h, 4)}
                fill={fill}
                stroke="none"
                className="transition-all duration-500"
              />
              {showValues ? (
                <text
                  x={round2(x + barW / 2)}
                  y={round2(y - 6)}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill={isHover ? HOVER_COLOR : '#cbd5e1'}
                  className="transition-all duration-500"
                >
                  {valueFormat(value)}
                </text>
              ) : null}
            </g>
          )
        })}

        {/* x 轴标签 */}
        {showAxis
          ? data.map((d, i) => {
              const cx = padLeft + i * step + step / 2
              if (rotateLabels) {
                return (
                  <text
                    key={`bx-${d.label}-${i}`}
                    x={round2(cx)}
                    y={round2(baseline + 12)}
                    textAnchor="end"
                    fontSize={10.5}
                    fill={AXIS_COLOR}
                    transform={`rotate(-45 ${round2(cx)} ${round2(baseline + 12)})`}
                  >
                    {d.label}
                  </text>
                )
              }
              return (
                <text
                  key={`bx-${d.label}-${i}`}
                  x={round2(cx)}
                  y={round2(baseline + 16)}
                  textAnchor="middle"
                  fontSize={10.5}
                  fill={AXIS_COLOR}
                >
                  {d.label}
                </text>
              )
            })
          : null}
      </svg>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* RankBars                                                            */
/* ------------------------------------------------------------------ */

export function RankBars({
  data,
  valueFormat = defaultFormat,
  max,
  accent = DEFAULT_ACCENT,
}: RankBarsProps): JSX.Element {
  if (data.length === 0) return <EmptyState height={120} />

  const values = data.map((d) => (isFiniteNumber(d.value) ? d.value : 0))
  const computedMax = maxOf(values)
  const ceiling = max !== undefined && isFiniteNumber(max) && max > 0 ? max : computedMax

  return (
    <div className="flex w-full flex-col gap-3">
      {data.map((d, i) => {
        const value = values[i]
        const ratio = ceiling > 0 ? Math.min(1, Math.max(0, value / ceiling)) : 0
        return (
          <div key={`rank-${d.label}-${i}`} className="group flex flex-col gap-1.5">
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2">
                <span
                  className="truncate text-xs font-medium text-slate-200"
                  style={{ maxWidth: '40%' }}
                  title={d.label}
                >
                  {d.label}
                </span>
                {d.sub ? <span className="truncate text-[10px] text-slate-500">{d.sub}</span> : null}
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-300">
                {valueFormat(value)}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${ratio * 100}%`,
                  background: `linear-gradient(90deg, ${accent}, ${SECONDARY_ACCENT})`,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* DonutChart                                                          */
/* ------------------------------------------------------------------ */

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
  legendColumns = 2,
}: DonutChartProps): JSX.Element {
  const values = data.map((d) => (isFiniteNumber(d.value) ? d.value : 0))
  const total = values.reduce((acc, v) => acc + v, 0)
  const hasData = data.length > 0 && total > 0

  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const cx = size / 2
  const cy = size / 2
  const gap = 2

  let offset = 0
  const segments = data.map((d, i) => {
    const frac = hasData ? values[i] / total : 0
    const len = Math.max(0, frac * c - gap)
    const seg = { d, len, offset, color: d.color || PALETTE[i % PALETTE.length] }
    offset += frac * c
    return seg
  })

  return (
    <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="block">
          {/* 底环 */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(148,163,184,0.10)" strokeWidth={thickness} />
          {hasData
            ? segments.map((seg, i) => (
                <circle
                  key={`seg-${seg.d.label}-${i}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${round2(seg.len)} ${round2(c - seg.len)}`}
                  strokeDashoffset={round2(-seg.offset)}
                  strokeLinecap="butt"
                  transform={`rotate(-90 ${cx} ${cy})`}
                  className="transition-all duration-500"
                />
              ))
            : null}
          {hasData ? (
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize={22} fontWeight={600} fill="#e2e8f0">
              {centerValue !== undefined ? centerValue : defaultFormat(total)}
            </text>
          ) : null}
          {hasData ? (
            <text x={cx} y={cy + 16} textAnchor="middle" fontSize={11} fill={AXIS_COLOR}>
              {centerLabel !== undefined ? centerLabel : '总计'}
            </text>
          ) : null}
        </svg>
        {!hasData ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">暂无数据</div>
        ) : null}
      </div>

      {/* 图例 */}
      {hasData ? (
        <ul
          className={
            legendColumns === 1
              ? 'grid w-full grid-cols-1 gap-x-6 gap-y-2'
              : 'grid w-full grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2'
          }
        >
          {data.map((d, i) => {
            const pct = total > 0 ? (values[i] / total) * 100 : 0
            const color = d.color || PALETTE[i % PALETTE.length]
            return (
              <li key={`legend-${d.label}-${i}`} className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400" title={d.label}>
                  {d.label}
                </span>
                <span className="shrink-0 text-xs font-medium tabular-nums text-slate-200">
                  {pct >= 10 ? `${Math.round(pct)}%` : `${pct.toFixed(1)}%`}
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* StatTile                                                            */
/* ------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  delta,
  hint,
  icon,
  accent = DEFAULT_ACCENT,
}: StatTileProps): JSX.Element {
  const isNegative = typeof delta === 'string' && delta.trim().startsWith('-')

  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-slate-500">{label}</div>
          <div className="mt-1.5 text-3xl font-semibold tabular-nums text-slate-100">{value}</div>
        </div>
        {icon ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
            style={{
              backgroundColor: withAlpha(accent, 0.12),
              borderColor: withAlpha(accent, 0.28),
              color: accent,
            }}
          >
            {icon}
          </div>
        ) : null}
      </div>

      {delta || hint ? (
        <div className="mt-2 flex items-center gap-2">
          {delta ? (
            <span className={`text-xs font-medium ${isNegative ? 'text-rose-400' : 'text-cyan-400'}`}>{delta}</span>
          ) : null}
          {hint ? <span className="truncate text-[11px] text-slate-500">{hint}</span> : null}
        </div>
      ) : null}
    </div>
  )
}
