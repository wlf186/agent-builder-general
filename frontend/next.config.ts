import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Docs-site proxy
      {
        source: '/docs/:path*',
        destination: 'http://localhost:4173/:path*',
      },
      {
        source: '/docs',
        destination: 'http://localhost:4173/',
      },
      // Langfuse proxy
      {
        source: '/langfuse/:path*',
        destination: 'http://localhost:3000/:path*',
      },
      {
        source: '/langfuse',
        destination: 'http://localhost:3000/',
      },
      // Backend API proxy
      {
        source: '/api/:path*',
        destination: 'http://localhost:20881/api/:path*',
      },
    ];
  },
};

export default nextConfig;
