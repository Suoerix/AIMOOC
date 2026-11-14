/** @type {import('next').NextConfig} */

// 生产环境不再下发浏览器 sourcemap：避免把提示词、内部接口和实现细节公开，
// 同时减少首屏下载体积。
// 注意：frame-ancestors / X-Frame-Options 刻意不设置，站点需要能被预览面板
// 与第三方 LMS 嵌入；点击劫持防护改由沙箱 iframe 与 SameSite=Lax 会话承担。
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "media-src 'self' https: blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  images: {
    domains: [process.env.SUPABASE_HOSTNAME || 'xxxx.supabase.co', 'avatars.dicebear.com'],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      punycode: false,
    }
    return config
  },
}

module.exports = nextConfig
