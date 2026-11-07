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

## 页面一览

| 路由 | 说明 |
| --- | --- |
| `/` | 主页：Chatbot 入口 + 6 个可视化案例广场 |
| `/learn/[id]` | AI 教室：可视化舞台 + AI 助教（含课堂笔记、时长埋点） |
| `/demo/[case]` | 案例沉浸式体验页 |
| `/history` | 学习历史：课程卡片、进度条、继续学习、筛选搜索 |
| `/notes` | 我的笔记：课堂随手记 + 独立笔记 |
| `/progress` | 学习进度：时长趋势、学科分布、最近在学 |
| `/admin` | 数据看板：用户数、时长、DAU、热门内容 Top10、学科分布 |
| `/tech` | 技术栈页：选型、架构图、数据流、目录结构、API 与环境变量 |

## 账号体系与反滥用

账号不是摆设 —— 它同时承担**登录后同步学习数据**与**限制刷接口**两件事。

- **登录方式**：邮箱 + 密码注册登录、GitHub OAuth（Supabase Auth）
- **分级配额**（middleware 统一拦截，按天重置）：

| 身份 | 课件/实验/出题 | 助教对话 |
| --- | --- | --- |
| 匿名（按 IP） | 5 次/天 | 50 次/天 |
| 已登录（按邮箱） | 30 次/天 | 500 次/天 |

- 超限返回 429 与中文提示；教室顶栏实时显示「今日剩余 N/M 次生成」，未登录时提供「登录提升额度」入口
- 未配置 Upstash 时不硬限流（仅提示），避免本地开发被卡住
- 账号体系是**可选增强**：未配置 Supabase 时全站照常运行，学习数据落在浏览器本地

## 学习数据与后台看板

- 教室页每 30 秒上报一次学习事件（课程、学科、停留时长），切后台/离开时补报
- 学习历史 / 笔记 / 进度写入 Supabase（`user_courses`、`study_notes`），同时保留本地副本
- `/admin` 由服务端 `service role` 聚合 `study_events`：注册用户数、总学习时长、今日活跃、平均单次时长、14 天时长趋势、日活柱状、热门内容 Top10、学科分布环形图
- 管理员判定：`SUPABASE_ADMIN_EMAILS` 白名单 **或** `user_profiles.role = 'admin'`
- 未接入 Supabase 时看板展示标注为 `DEMO` 的演示数据，方便对外演示

## 技术栈

Next.js 14（Pages Router）· TypeScript · Tailwind CSS · framer-motion · OpenAI SDK · 讯飞 TTS（WebSocket）· Supabase（账号与学习数据）· Upstash（缓存与配额）· Vercel Serverless

全部能力都是**无状态 API Route**，不依赖本地文件系统与长驻进程，可直接部署在 Vercel 这类 Serverless 环境。

### API 一览

| 路由 | 作用 |
| --- | --- |
| `POST /api/courseware` | 字幕 → 流式课件（行协议） |
| `POST /api/visualize` | 字幕 → 流式自包含交互 HTML |
| `POST /api/quiz` | 字幕 → 互动选择题（JSON） |
| `POST /api/chat` | `mode=router` 主页接待 / `mode=ta` 课堂助教 |
| `POST /api/tts` | 讯飞语音合成 → base64 MP3；`{probe:true}` 探测是否已配置 |
| `POST /api/track` | 学习埋点上报（时长 / 课程 / 学科） |
| `GET /api/quota` | 查询今日剩余额度 |
| `GET /api/admin/stats` | 后台聚合统计（仅管理员） |
| `POST /api/sumup` | 经典视频总结（保留） |
| `GET /api/bilibili/*` | 视频信息、字幕、视频流、扫码登录 |
| `GET /api/b23tv?url=` | B 站短链解析 |

### 目录结构

```
components/
  Home/        AuroraBackground · ChatEntry（Chatbot 入口）· CaseGallery
  classroom/   CoursewareView · VisualizationStage · TeachingAssistant · QuizCard · VideoDock
  auth/        AuthModal（登录 / 注册）
  admin/       Charts（纯 SVG 图表：AreaTrend / BarSeries / RankBars / Donut / StatTile）
  Nav.tsx      全站导航（含账号菜单）
  BilibiliLogin.tsx
hooks/         useCourseware · useVisualize · useQuiz · useTTS
lib/
  cases/       6 个预设可视化案例（自包含 HTML 字符串）
  ai/prompts   课件 / 可视化 / 出题 / 助教 / 路由 的 System Prompt
  tts/xunfei   讯飞 v2 WebSocket 合成封装
  bilibili/    视频信息、字幕、视频流、鉴权
  history.ts   学习历史 / 笔记 数据层（本地 + Supabase 双写）
  quota.ts     反滥用配额（匿名 / 登录分级）
  supabase/    账号上下文与服务端 service role 客户端
pages/
  index.tsx    主页
  demo/[case]  案例沉浸式体验页
  learn/[id]   AI 教室（桌面：舞台 + 右栏助教；移动端：舞台 + 底部抽屉助教）
  history.tsx  学习历史
  notes.tsx    我的笔记
  progress.tsx 学习进度
  admin/       数据看板
  tech.tsx     技术栈介绍
  api/         所有后端能力
supabase/
  schema.sql   建表脚本（user_courses / study_notes / study_events / user_profiles）
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
| `UPSTASH_REDIS_REST_*` | 可选：总结缓存 + **每日配额计数**（不配置则不限流） |
| `NEXT_PUBLIC_SUPABASE_URL` `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 账号体系与学习数据同步；未配置时全站降级为本地模式 |
| `SUPABASE_SERVICE_ROLE_KEY` | 服务端专用，后台看板聚合 `study_events` 时需要（勿暴露给前端） |
| `SUPABASE_ADMIN_EMAILS` | 管理员邮箱白名单（逗号分隔），用于访问 `/admin` |

## 启用账号与后台（可选，约 5 分钟）

1. 在 Supabase 新建项目，拿到 URL 与 anon key；
2. 在 Supabase → SQL Editor 执行 `supabase/schema.sql`；
3. 复制 `.example.env` 为 `.env.local`，填入：
   `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、
   `SUPABASE_ADMIN_EMAILS`（你自己的邮箱）、`UPSTASH_RATE_REDIS_REST_*`（配额）；
4. 重新 `npm run dev`，即可注册登录、学习数据上云、后台看板显示真实数据。

> Supabase 认证设置里建议开启 Email 登录，并关闭邮箱自动确认以外的第三方限制；
> GitHub 登录需要在 Supabase Auth → Providers 中配置 OAuth App 的 Client ID/Secret。

> 部署在海外区域时，B 站接口可能触发风控，建议配置 `BILIBILI_API_BASE`（自建反代）或 `BILIBILI_PROXY`；
> 部分视频的字幕需要登录后才可见，可在教室右上角点电视图标扫码登录（凭证仅存浏览器本地）。

## 移动端

课堂界面在移动端切换为「舞台 + 底部抽屉助教」：右下角悬浮「AI 助教」按钮拉起抽屉，手势收起，输入框适配软键盘与安全区。
