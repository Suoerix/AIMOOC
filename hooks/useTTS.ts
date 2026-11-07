import { useCallback, useEffect, useRef, useState } from 'react'

export type TtsMode = 'xfyun' | 'browser' | 'off'

/**
 * AI 助教语音：优先讯飞 TTS（服务端合成 MP3），未配置/失败时回退浏览器 speechSynthesis。
 */
export function useTTS() {
  const [mode, setMode] = useState<TtsMode>('browser')
  const [speaking, setSpeaking] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const seqRef = useRef(0)
  // 浏览器自动播放策略会拦截无用户手势的音频：先暂存，等首次点击再补播
  const pendingRef = useRef<string>('')
  const speakRef = useRef<((text: string) => void) | null>(null)

  useEffect(() => {
    const unlock = () => {
      const pending = pendingRef.current
      pendingRef.current = ''
      if (pending) speakRef.current?.(pending)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    // 探测服务端讯飞 TTS 是否可用
    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ probe: true }),
    })
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d: { configured?: boolean }) => setMode(d?.configured ? 'xfyun' : 'browser'))
      .catch(() => setMode('browser'))

    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const stop = useCallback(() => {
    seqRef.current++
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    setSpeaking(false)
  }, [])

  const speak = useCallback(
    async (text: string) => {
      if (!enabled || !text?.trim()) return
      const seq = ++seqRef.current

      // 截断：讯飞单次上限约 2000 汉字
      const clipped = text.trim().slice(0, 500)

      if (mode === 'off') return

      if (mode === 'xfyun') {
        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clipped }),
          })
          if (!res.ok) throw new Error('tts failed')
          const data = await res.json()
          if (seq !== seqRef.current) return
          const audio = new Audio(`data:${data.mime};base64,${data.audio}`)
          audioRef.current = audio
          setSpeaking(true)
          audio.onended = () => setSpeaking(false)
          audio.onerror = () => setSpeaking(false)
          try {
            await audio.play()
          } catch {
            // 自动播放被拦截：等用户首次交互后补播
            pendingRef.current = clipped
            setSpeaking(false)
          }
          return
        } catch {
          // 回退浏览器 TTS
          setMode('browser')
        }
      }

      // 浏览器回退
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
        const utter = new SpeechSynthesisUtterance(clipped)
        utter.lang = 'zh-CN'
        utter.rate = 1.05
        const zh = window.speechSynthesis
          .getVoices()
          .find((v) => v.lang?.startsWith('zh'))
        if (zh) utter.voice = zh
        utter.onend = () => setSpeaking(false)
        utter.onerror = () => setSpeaking(false)
        if (seq !== seqRef.current) return
        setSpeaking(true)
        window.speechSynthesis.speak(utter)
      }
    },
    [enabled, mode]
  )

  // 供解锁监听调用最新版本（避免闭包捕获旧 mode/enabled）
  speakRef.current = speak

  return { speak, stop, speaking, mode, enabled, setEnabled }
}
