# 弘识智教 AIMOOC · AI 教室

把每一个 B 站视频，变成一堂可以动手参与的 AI 课。

AIMOOC 不是「视频 + 字幕 + 总结」的播放器升级版，而是一间 **AI 教室**：
视频只是素材，真正的主讲是**可视化教学**，坐在你旁边的是会说话、会提问、会给你现场写实验的 **AI 助教**。

---

## 三个核心能力

**1. 可视化教学优先**
AI 读取视频字幕，分析知识点，现场编写一个**自包含的交互式 HTML 实验**（Canvas / three.js / 纯 CSS，无外部依赖），在沙箱 iframe 里运行。调参数、看变化、做类比 —— 比看视频更快建立直觉。

**2. 视频 → 课件**
字幕流式交给模型，按 `#S 标题 | 时间戳` / `- 要点` / `#T 讲解词` 的行协议边生成边渲染成幻灯片。每页都带视频时间戳，可一键跳回原片对应位置。

**3. AI 助教（右侧栏）**
- 讯飞在线语音合成（未配置时自动回退浏览器语音）
- 翻页自动讲解、生成实验前预告、答错时鼓励并给回看建议
- 课堂互动出题：选择题卡片 + 即时判分 + 解析 + 跳回视频
- 支持自由提问（带课程上下文流式回答）

## 主页

- 深空极光背景 + 入场编排动画
- 核心入口是一个 Chatbot：粘贴 B 站链接（含 `b23.tv` 短链）直接进教室，或描述需求让 AI 路由
- 内置 6 个可视化教学案例，卡片里是**真实运行的 iframe 预览**（不是截图）：

| 案例 | 学科 | 形态 |
| --- | --- | --- |
| 抛体运动实验室 | 物理 · 运动学 | Canvas 实时轨迹、自适应缩放 |
| 傅里叶级数可视化 | 数学 · 信号分析 | 旋转矢量叠加逼近方波 |
| 排序算法可视化 | 计算机 · 算法 | 四种排序的柱状动画 + 计数统计 |
| 太阳系 3D 探索 | 天文 | three.js 轨道与行星 |
| 分形树生长实验室 | 数学 · 递归 | 递归树生长动画 |
| 元素周期表实验室 | 化学 | 交互周期表 + 知识小测 |

## 技术栈

Next.js 14（Pages Router）· TypeScript · Tailwind CSS · framer-motion · OpenAI SDK · 讯飞 TTS（WebSocket）· Supabase（可选账号）· Upstash（可选缓存/限流）

全部能力都是**无状态 API Route**，不依赖本地文件系统与长驻进程，可直接部署在 Vercel 这类 Serverless 环境。

### API 一览

| 路由 | 作用 |
| --- | --- |
| `POST /api/courseware` | 字幕 → 流式课件（行协议） |
| `POST /api/visualize` | 字幕 → 流式自包含交互 HTML |
| `POST /api/quiz` | 字幕 → 互动选择题（JSON） |
| `POST /api/chat` | `mode=router` 主页接待 / `mode=ta` 课堂助教 |
| `POST /api/tts` | 讯飞语音合成 → base64 MP3；`{probe:true}` 探测是否已配置 |
| `POST /api/sumup` | 经典视频总结（保留） |
| `GET /api/bilibili/*` | 视频信息、字幕、视频流、扫码登录 |
| `GET /api/b23tv?url=` | B 站短链解析 |

### 目录结构

```
components/
  Home/        AuroraBackground · ChatEntry（Chatbot 入口）· CaseGallery
  classroom/   CoursewareView · VisualizationStage · TeachingAssistant · QuizCard · VideoDock
  BilibiliLogin.tsx
hooks/         useCourseware · useVisualize · useQuiz · useTTS
lib/
  cases/       6 个预设可视化案例（自包含 HTML 字符串）
  ai/prompts   课件 / 可视化 / 出题 / 助教 / 路由 的 System Prompt
  tts/xunfei   讯飞 v2 WebSocket 合成封装
  bilibili/    视频信息、字幕、视频流、鉴权
pages/
  index.tsx    主页
  demo/[case]  案例沉浸式体验页
  learn/[id]   AI 教室（桌面：舞台 + 右栏助教；移动端：舞台 + 底部抽屉助教）
  api/         所有后端能力
```

## 快速开始

```bash
git clone https://github.com/JinHanLei/AIMOOC.git
cd AIMOOC
npm install
cp .example.env .env.local   # 至少填 OPENAI_API_KEY
npm run dev
```

### 环境变量（全部可选项除 API Key）

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | 必填。AI 总结 / 课件 / 可视化 / 出题 / 助教 |
| `OPENAI_BASE_URL` `OPENAI_MODEL` | OpenAI 兼容网关与模型名（默认 `gpt-4o-mini`） |
| `XFYUN_APP_ID` `XFYUN_API_KEY` `XFYUN_API_SECRET` | 讯飞在线语音合成；缺失则用浏览器语音 |
| `BILIBILI_SESSION_TOKEN` `BILIBILI_PROXY` | B 站字幕兜底凭证 / 海外风控时的 API 代理 |
| `UPSTASH_REDIS_REST_*` | 可选：总结缓存与限流 |
| `NEXT_PUBLIC_SUPABASE_*` | 可选：账号体系；未配置时全站照常运行 |

## 部署到 Vercel

1. 导入仓库；
2. 按 `.example.env` 配置环境变量（`OPENAI_API_KEY` 必填）；
3. 部署即可，无需独立后端。

> 部署在海外区域时，B 站接口可能触发风控，建议配置 `BILIBILI_API_BASE`（自建反代）或 `BILIBILI_PROXY`；
> 部分视频的字幕需要登录后才可见，可在教室右上角点电视图标扫码登录（凭证仅存浏览器本地）。

## 移动端

课堂界面在移动端切换为「舞台 + 底部抽屉助教」：右下角悬浮「AI 助教」按钮拉起抽屉，手势收起，输入框适配软键盘与安全区。
