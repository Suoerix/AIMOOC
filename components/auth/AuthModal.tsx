import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, LogIn, UserPlus, Github, X, ShieldCheck } from 'lucide-react'
import { toast } from 'react-hot-toast'
// 统一使用 client.ts 的 cookie 客户端单例，登录态写入 cookie 供服务端验签
import { getSupabaseBrowserClient as getSupabase } from '~/lib/supabase/client'
import { useAuth } from '~/lib/supabase/auth-context'
import { cn } from '~/lib/utils'

interface AuthModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: 'signin' | 'signup'
}

export function AuthModal({ open, onClose, defaultTab = 'signin' }: AuthModalProps) {
  const { user, configured } = useAuth()
  const [tab, setTab] = useState<'signin' | 'signup'>(defaultTab)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) setTab(defaultTab)
  }, [open, defaultTab])

  useEffect(() => {
    if (user && open) onClose()
  }, [user, open, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const supabase = getSupabase()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) {
      toast.error('当前部署未接入 Supabase，账号功能不可用')
      return
    }
    setLoading(true)
    try {
      if (tab === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (data.session) {
          toast.success('注册成功，欢迎加入弘识智教！', { icon: '🎓' })
          onClose()
        } else {
          toast.success('注册成功，请到邮箱点击验证链接后登录', { icon: '📧' })
          onClose()
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        toast.success('登录成功，欢迎回来！', { icon: '🎓' })
        onClose()
      }
    } catch (err: any) {
      const msg = String(err?.message || '操作失败')
      toast.error(
        msg.includes('Invalid login credentials')
          ? '邮箱或密码不正确'
          : msg.includes('already registered')
          ? '该邮箱已注册，请直接登录'
          : msg,
      )
    } finally {
      setLoading(false)
    }
  }

  const handleGithub = async () => {
    if (!supabase) {
      toast.error('当前部署未接入 Supabase，账号功能不可用')
      return
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) toast.error(error.message)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.21, 1.02, 0.73, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-md rounded-t-3xl p-6 shadow-2xl shadow-black/60 sm:rounded-3xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold text-slate-100">
                  {tab === 'signin' ? '登录弘识智教' : '创建账号'}
                </h3>
                <p className="mt-1 text-xs text-slate-500">登录后可同步学习历史、笔记与进度，并获得更高 AI 生成额度</p>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-300"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {!configured && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2.5 text-[11.5px] leading-relaxed text-amber-200/90">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                当前部署未配置 Supabase，账号功能处于降级状态（学习数据仍保存在本机浏览器）。
              </div>
            )}

            {/* Tab */}
            <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/[0.04] p-1">
              {(
                [
                  { key: 'signin', label: '登录', icon: LogIn },
                  { key: 'signup', label: '注册', icon: UserPlus },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-medium transition-all',
                    tab === key
                      ? 'bg-gradient-to-r from-cyan-500/25 to-violet-500/25 text-white'
                      : 'text-slate-500 hover:text-slate-300',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱地址"
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="密码（至少 6 位）"
                  className="h-11 w-full rounded-xl border border-white/[0.07] bg-white/[0.03] pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !configured}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
              >
                {tab === 'signin' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {loading ? '处理中…' : tab === 'signin' ? '登录' : '注册并开始学习'}
              </button>
            </form>

            <div className="my-4 flex items-center gap-3">
              <span className="h-px flex-1 bg-white/[0.08]" />
              <span className="text-[11px] text-slate-600">或</span>
              <span className="h-px flex-1 bg-white/[0.08]" />
            </div>

            <button
              onClick={handleGithub}
              disabled={!configured}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] text-sm text-slate-300 transition-colors hover:bg-white/[0.06] disabled:opacity-50"
            >
              <Github className="h-4 w-4" />
              使用 GitHub 登录
            </button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-600">
              <User className="h-3 w-3" />
              登录仅用于同步学习数据与限制滥用，不收集任何额外个人信息
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
