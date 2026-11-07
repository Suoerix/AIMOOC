import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GraduationCap,
  LogIn,
  LogOut,
  Menu,
  X,
  History,
  StickyNote,
  Gauge,
  Cpu,
  BarChart3,
  LayoutGrid,
  User,
} from 'lucide-react'
import { toast } from 'react-hot-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '~/components/ui/avatar'
import { AuthModal } from '~/components/auth/AuthModal'
import { useAuth } from '~/lib/supabase/auth-context'
import { getSupabase } from '~/lib/supabase'
import { cn } from '~/lib/utils'

const LINKS = [
  { href: '/', label: '首页', icon: GraduationCap, key: 'home' },
  { href: '/#cases', label: '案例', icon: LayoutGrid, key: 'cases' },
  { href: '/history', label: '学习历史', icon: History, key: 'history' },
  { href: '/notes', label: '笔记', icon: StickyNote, key: 'notes' },
  { href: '/progress', label: '进度', icon: Gauge, key: 'progress' },
  { href: '/tech', label: '技术栈', icon: Cpu, key: 'tech' },
  { href: '/admin', label: '后台', icon: BarChart3, key: 'admin' },
]

interface NavProps {
  /** 当前高亮的导航项 key */
  active?: string
}

export function Nav({ active }: NavProps) {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const signOut = async () => {
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error(error.message)
      return
    }
    toast.success('已退出登录')
    if (router.pathname.startsWith('/admin')) router.push('/')
  }

  const isActive = (key: string) =>
    active ? active === key : router.pathname === (LINKS.find((l) => l.key === key)?.href ?? '')

  return (
    <>
      <header className="glass-strong fixed inset-x-0 top-0 z-50 h-[60px]">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-violet-500/30">
              <GraduationCap className="h-[18px] w-[18px] text-cyan-200" />
            </span>
            <span className="hidden text-sm font-semibold tracking-wide text-slate-100 sm:block">
              弘识智教
            </span>
          </Link>

          {/* 桌面导航 */}
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {LINKS.map(({ href, label, icon: Icon, key }) => (
              <Link
                key={key}
                href={href}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors',
                  isActive(key)
                    ? 'bg-white/[0.07] text-cyan-200'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {/* 账号 */}
            {loading ? (
              <div className="h-9 w-24 animate-pulse rounded-xl bg-white/[0.05]" />
            ) : user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <div className="rounded-full bg-cyan-500/10 p-0.5 transition hover:ring-2 hover:ring-cyan-400/40">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-violet-600 text-xs text-white">
                        {(user.email || 'U').charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none text-slate-100">
                        {user.user_metadata?.full_name || user.user_metadata?.name || '学习者'}
                      </p>
                      <p className="text-xs leading-none text-slate-500">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/history" className="cursor-pointer">
                      <History className="mr-2 h-4 w-4" /> 学习历史
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/notes" className="cursor-pointer">
                      <StickyNote className="mr-2 h-4 w-4" /> 我的笔记
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/progress" className="cursor-pointer">
                      <Gauge className="mr-2 h-4 w-4" /> 学习进度
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={signOut}
                    className="cursor-pointer text-rose-300 focus:text-rose-200"
                  >
                    <LogOut className="mr-2 h-4 w-4" /> 退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="flex h-9 items-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500/25 to-violet-500/25 px-3.5 text-[13px] font-medium text-cyan-100 transition-colors hover:from-cyan-500/40 hover:to-violet-500/40"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">登录</span>
              </button>
            )}

            {/* 移动端菜单 */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-white/[0.06] lg:hidden"
              aria-label="菜单"
            >
              {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {/* 移动端下拉 */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden border-t border-white/[0.06] lg:hidden"
            >
              <div className="grid grid-cols-2 gap-1 p-3">
                {LINKS.map(({ href, label, icon: Icon, key }) => (
                  <Link
                    key={key}
                    href={href}
                    onClick={() => setMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-2 rounded-xl px-3 py-2.5 text-[13px] transition-colors',
                      isActive(key)
                        ? 'bg-white/[0.07] text-cyan-200'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                ))}
                {!user && (
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setAuthOpen(true)
                    }}
                    className="col-span-2 mt-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500/25 to-violet-500/25 px-3 py-2.5 text-[13px] font-medium text-cyan-100"
                  >
                    <User className="h-4 w-4" />
                    登录 / 注册
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
