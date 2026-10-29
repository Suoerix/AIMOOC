/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  productionBrowserSourceMaps: true,
  images: {
    domains: [process.env.SUPABASE_HOSTNAME || 'xxxx.supabase.co', 'avatars.dicebear.com'],
  },
  webpack: (config, { dev, isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      punycode: false,
    }
    return config
  },
  async rewrites() {
    return [
      {
        source: '/blocked',
        destination: '/shop',
      },
    ]
  },
}

module.exports = nextConfig
