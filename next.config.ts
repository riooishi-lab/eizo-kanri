import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  // Turbopackが日本語パスで誤動作するため、ルートを明示的に指定
  turbopack: {
    root: path.resolve(__dirname),
  },
}

export default nextConfig
