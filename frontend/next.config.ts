import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Backend API proxy
      {
        source: '/api/:path*',
        destination: 'http://localhost:20881/api/:path*',
      },
      // Docs-site proxy (VitePress 使用 base: '/docs/'，所以目标路径也需要包含 /docs)
      {
        source: '/docs/:path*',
        destination: 'http://localhost:4173/docs/:path*',
      },
      {
        source: '/docs',
        destination: 'http://localhost:4173/docs',
      },
      // 注意：Langfuse 不使用代理，因为它也是 Next.js 应用，/_next 路径会冲突
      // Langfuse 链接直接访问 http://localhost:3000
    ];
  },
};

export default nextConfig;
