import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Button } from '~/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { useToast } from '~/hooks/use-toast'
import {
  BILI_AUTH_CHANGE_EVENT,
  BiliAuth,
  clearBiliAuth,
  getBiliAuth,
  setBiliAuth,
} from '~/lib/bilibili/auth'
import { Loader2, QrCode, RefreshCw, ShieldCheck, LogOut } from 'lucide-react'

interface BilibiliLoginProps {
  show: boolean
  onClose: () => void
}

type PollStatus = 'idle' | 'loading' | 'waiting' | 'scanned' | 'expired' | 'error'

interface LoginUser {
  mid: number
  uname: string
  face: string
}

export default function BilibiliLogin({ show, onClose }: BilibiliLoginProps) {
  const [auth, setAuthState] = useState<BiliAuth | null>(null)
  const [qrcodeImg, setQrcodeImg] = useState('')
  const [qrcodeKey, setQrcodeKey] = useState('')
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle')
  const [manualInput, setManualInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const startedRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    setAuthState(getBiliAuth())
    const onChange = () => setAuthState(getBiliAuth())
    window.addEventListener(BILI_AUTH_CHANGE_EVENT, onChange)
    return () => window.removeEventListener(BILI_AUTH_CHANGE_EVENT, onChange)
  }, [])

  useEffect(() => {
    const onKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (show) {
      document.addEventListener('keydown', onKeydown)
    }
    return () => document.removeEventListener('keydown', onKeydown)
  }, [show, onClose])

  const generateQrcode = useCallback(async () => {
    setPollStatus('loading')
    setQrcodeImg('')
    setQrcodeKey('')
    try {
      const response = await fetch('/api/bilibili/login/qrcode')
      if (!response.ok) throw new Error('生成二维码失败')
      const data = await response.json()
      const dataUrl = await QRCode.toDataURL(data.url, { width: 220, margin: 1 })
      setQrcodeImg(dataUrl)
      setQrcodeKey(data.qrcodeKey)
      setPollStatus('waiting')
    } catch (error) {
      console.error('生成二维码失败:', error)
      setPollStatus('error')
    }
  }, [])

  useEffect(() => {
    if (show && !startedRef.current) {
      startedRef.current = true
      if (!getBiliAuth()) {
        generateQrcode()
      }
    }
  }, [show, generateQrcode])

  useEffect(() => {
    if (!qrcodeKey) return
    let stopped = false

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/bilibili/login/poll?key=${encodeURIComponent(qrcodeKey)}`
        )
        if (!response.ok) return
        const data = await response.json()

        if (stopped) return

        if (data.status === 'success' && data.cookie) {
          stopped = true
          setBiliAuth(data.cookie, data.user as LoginUser)
          toast({
            title: 'B站登录成功',
            description: data.user?.uname ? `欢迎，${data.user.uname}` : undefined,
          })
        } else if (data.status === 'scanned') {
          setPollStatus('scanned')
        } else if (data.status === 'expired') {
          stopped = true
          setPollStatus('expired')
        }
      } catch (error) {
        console.error('轮询扫码状态失败:', error)
      }
    }

    const timer = setInterval(() => {
      if (!stopped) poll()
    }, 2000)

    return () => {
      stopped = true
      clearInterval(timer)
    }
  }, [qrcodeKey, toast])

  const handleManualSave = async () => {
    const value = manualInput.trim()
    if (!value) {
      toast({
        title: '请输入 SESSDATA 或完整 Cookie',
        variant: 'destructive',
      })
      return
    }

    setVerifying(true)
    try {
      const response = await fetch('/api/bilibili/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: value }),
      })
      const data = await response.json()

      if (!response.ok || !data.loggedIn) {
        toast({
          title: '凭证无效',
          description: '请检查 SESSDATA / Cookie 是否正确或已过期',
          variant: 'destructive',
        })
        return
      }

      setBiliAuth(data.cookie, data.user)
      setManualInput('')
      toast({
        title: 'B站登录成功',
        description: data.user?.uname ? `欢迎，${data.user.uname}` : undefined,
      })
    } catch (error) {
      console.error('验证凭证失败:', error)
      toast({ title: '验证失败，请重试', variant: 'destructive' })
    } finally {
      setVerifying(false)
    }
  }

  const handleLogout = () => {
    clearBiliAuth()
    setManualInput('')
    generateQrcode()
    toast({ title: '已退出B站登录' })
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-pink-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">B站登录</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {auth ? (
          <div className="flex flex-col items-center gap-4 py-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={auth.user?.face}
              alt={auth.user?.uname}
              className="h-16 w-16 rounded-full border-2 border-pink-400"
            />
            <div className="text-center">
              <p className="font-medium text-gray-900 dark:text-white">{auth.user?.uname}</p>
              <p className="mt-1 flex items-center justify-center gap-1 text-xs text-green-600 dark:text-green-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                登录凭证已保存到本地浏览器
              </p>
            </div>
            <Button variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              退出登录
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="qrcode">
            <TabsList className="w-full">
              <TabsTrigger value="qrcode" className="flex-1">
                扫码登录
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1">
                手动填入
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qrcode" className="mt-4">
              <div className="flex flex-col items-center gap-3">
                {pollStatus === 'loading' && (
                  <div className="flex h-[220px] w-[220px] items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                )}

                {qrcodeImg && pollStatus !== 'loading' && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrcodeImg}
                      alt="B站登录二维码"
                      className={pollStatus === 'expired' ? 'opacity-30' : ''}
                      width={220}
                      height={220}
                    />
                    {pollStatus === 'expired' && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                        <span className="text-sm text-gray-600 dark:text-gray-300">二维码已过期</span>
                        <Button size="sm" onClick={generateQrcode} className="gap-1">
                          <RefreshCw className="h-3.5 w-3.5" />
                          点击刷新
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {pollStatus === 'error' && (
                  <div className="flex h-[220px] w-[220px] flex-col items-center justify-center gap-2">
                    <span className="text-sm text-gray-500">二维码生成失败</span>
                    <Button size="sm" variant="outline" onClick={generateQrcode} className="gap-1">
                      <RefreshCw className="h-3.5 w-3.5" />
                      重试
                    </Button>
                  </div>
                )}

                <p className="min-h-[20px] text-center text-sm text-gray-500 dark:text-gray-400">
                  {pollStatus === 'waiting' && '请使用B站 App 扫描二维码'}
                  {pollStatus === 'scanned' && '已扫描，请在手机上确认登录'}
                  {pollStatus === 'expired' && '二维码已过期，请刷新后重新扫码'}
                  {pollStatus === 'error' && '生成二维码失败，请重试'}
                </p>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <div className="flex flex-col gap-3">
                <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                  粘贴
                  <a
                    href="https://www.bilibili.com"
                    target="_blank"
                    rel="noreferrer"
                    className="mx-1 text-pink-500 hover:underline"
                  >
                    bilibili.com
                  </a>
                  登录后的 SESSDATA 值，或包含 SESSDATA 的完整 Cookie 字符串。
                </p>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="SESSDATA=xxx 或 SESSDATA 值"
                  rows={3}
                  className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
                <Button
                  onClick={handleManualSave}
                  disabled={verifying}
                  className="gap-2 bg-pink-500 text-white hover:bg-pink-600"
                >
                  {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  验证并保存
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  )
}
