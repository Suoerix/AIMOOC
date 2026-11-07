import { projectileHTML } from './projectile'
import { fourierHTML } from './fourier'
import { sortingHTML } from './sorting'
import { solarHTML } from './solar'
import { fractalHTML } from './fractal'
import { periodicHTML } from './periodic'

export interface TeachingCase {
  id: string
  title: string
  subject: string
  description: string
  tags: string[]
  accent: string // 主题色（用于卡片光晕）
  icon: string
  keywords: string[] // 主页 ChatEntry 意图匹配用
  html: string
}

export const TEACHING_CASES: TeachingCase[] = [
  {
    id: 'projectile',
    title: '抛体运动实验室',
    subject: '物理 · 运动学',
    description: '调节发射角度与初速度，观察轨迹、射程与最大高度，理解抛体运动方程。',
    tags: ['物理', '运动学', '交互实验'],
    accent: '#22d3ee',
    icon: '🚀',
    keywords: ['物理', '抛体', '运动', '力学', '平抛', ' projectile'],
    html: projectileHTML,
  },
  {
    id: 'fourier',
    title: '傅里叶级数可视化',
    subject: '数学 · 信号分析',
    description: '用旋转矢量叠加逼近方波，观察吉布斯振荡，直观理解谐波合成。',
    tags: ['数学', '傅里叶', '波形'],
    accent: '#a78bfa',
    icon: '〰️',
    keywords: ['数学', '傅里叶', '信号', '波', '频谱', '方波'],
    html: fourierHTML,
  },
  {
    id: 'sorting',
    title: '排序算法可视化',
    subject: '计算机科学 · 算法',
    description: '冒泡 / 选择 / 插入 / 快排的柱状图动画，实时统计比较与交换次数。',
    tags: ['算法', '排序', '动画'],
    accent: '#34d399',
    icon: '📊',
    keywords: ['算法', '排序', '计算机', '编程', '快排', '冒泡'],
    html: sortingHTML,
  },
  {
    id: 'solar',
    title: '太阳系 3D 探索',
    subject: '天文 · 空间科学',
    description: '可旋转缩放的太阳系模型，调节公转速度，点击行星查看知识卡片。',
    tags: ['天文', '3D', '行星'],
    accent: '#fbbf24',
    icon: '🪐',
    keywords: ['天文', '太阳系', '行星', '宇宙', '3d', '地球', '木星'],
    html: solarHTML,
  },
  {
    id: 'fractal',
    title: '分形树生长实验室',
    subject: '数学 · 递归',
    description: '调节分支角度、深度与衰减率，观看递归树的生长动画，感受自相似结构。',
    tags: ['数学', '分形', '递归'],
    accent: '#f472b6',
    icon: '🌱',
    keywords: ['分形', '递归', '树', '数学', '几何'],
    html: fractalHTML,
  },
  {
    id: 'periodic',
    title: '元素周期表实验室',
    subject: '化学 · 物质科学',
    description: '交互式周期表：按类别筛选元素、点击查看详情，附元素知识小测验。',
    tags: ['化学', '元素', '周期表'],
    accent: '#f87171',
    icon: '⚗️',
    keywords: ['化学', '元素', '周期表', '原子'],
    html: periodicHTML,
  },
]

export function getCase(id: string): TeachingCase | undefined {
  return TEACHING_CASES.find((c) => c.id === id)
}

/** 依据用户输入的自然语言匹配最相关的案例 */
export function matchCases(text: string): TeachingCase[] {
  const t = text.toLowerCase()
  return TEACHING_CASES.filter((c) =>
    c.keywords.some((k) => t.includes(k.toLowerCase()))
  )
}
