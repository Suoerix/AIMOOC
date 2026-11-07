import { useEffect, useRef } from 'react'

/**
 * 星空 + 缓慢漂移粒子 + 光晕的科技感动画背景（canvas）
 */
export function AuroraBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let W = 0
    let H = 0
    let raf = 0
    let stars: { x: number; y: number; r: number; a: number; da: number; vy: number }[] = []
    let particles: { x: number; y: number; r: number; hue: number; vx: number; vy: number; life: number }[] = []

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      // 重新播撒星星
      stars = Array.from({ length: Math.round((W * H) / 9000) }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.3 + 0.3,
        a: Math.random() * 0.6 + 0.2,
        da: (Math.random() * 0.02 + 0.004) * (Math.random() > 0.5 ? 1 : -1),
        vy: Math.random() * 0.03,
      }))
    }

    const spawnParticle = () => {
      if (particles.length > 26) return
      particles.push({
        x: Math.random() * W,
        y: H + 10,
        r: Math.random() * 2.6 + 1,
        hue: [187, 258, 320][Math.floor(Math.random() * 3)],
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(Math.random() * 0.32 + 0.12),
        life: 1,
      })
    }

    let t = 0
    const draw = () => {
      t++
      ctx.clearRect(0, 0, W, H)

      // 星星闪烁
      for (const s of stars) {
        s.a += s.da
        if (s.a > 0.85 || s.a < 0.15) s.da *= -1
        s.y -= s.vy
        if (s.y < -2) s.y = H + 2
        ctx.fillStyle = `rgba(190, 210, 255, ${Math.max(0.05, s.a)})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      // 上升粒子
      if (t % 46 === 0) spawnParticle()
      particles = particles.filter((p) => p.life > 0 && p.y > -20)
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy
        p.life -= 0.0022
        const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 6)
        glow.addColorStop(0, `hsla(${p.hue}, 90%, 70%, ${0.4 * p.life})`)
        glow.addColorStop(1, `hsla(${p.hue}, 90%, 70%, 0)`)
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r * 6, 0, Math.PI * 2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* 底色 */}
      <div className="absolute inset-0 bg-[#040711]" />
      {/* 光晕 */}
      <div className="absolute -top-40 left-1/4 h-[480px] w-[480px] rounded-full bg-cyan-500/10 blur-[130px] animate-pulse-glow" />
      <div className="absolute -right-32 top-1/3 h-[420px] w-[420px] rounded-full bg-violet-600/10 blur-[130px] animate-pulse-glow" style={{ animationDelay: '1.4s' }} />
      <div className="absolute -bottom-40 left-1/3 h-[380px] w-[380px] rounded-full bg-blue-600/10 blur-[120px] animate-pulse-glow" style={{ animationDelay: '0.8s' }} />
      {/* 网格 */}
      <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      {/* 星空粒子 */}
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  )
}
