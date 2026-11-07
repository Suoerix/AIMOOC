import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-[#040711] px-6 text-center text-slate-100">
      <p className="text-gradient-cyan-violet text-7xl font-extrabold tracking-tight sm:text-8xl">
        404
      </p>
      <p className="text-xl font-semibold">这一课暂时不在这里</p>
      <p className="max-w-sm text-sm text-slate-500">
        页面可能已被移动或从未存在。回到首页，粘贴一个 B 站视频链接开始你的 AI 课堂吧。
      </p>
      <Link
        href="/"
        className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-cyan-500/25 transition-transform hover:scale-105 active:scale-95"
      >
        返回首页
      </Link>
    </div>
  )
}
