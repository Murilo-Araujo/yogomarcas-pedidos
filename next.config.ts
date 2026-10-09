import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  typescript: { tsconfigPath: 'tsconfig.app.json' },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/vendor/tabler/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }];
  },
  // Activate the bio page at the root once this domain is connected in Vercel.
  ...(process.env.YOGO_STATIC_EXPORT !== '1' ? {
    async rewrites() {
      return { beforeFiles: [{ source: '/', has: [{ type: 'host' as const, value: 'link.yogomarkets.com.br' }], destination: '/links' }] };
    },
  } : {}),
  ...(process.env.YOGO_STATIC_EXPORT==='1'?{output:'export' as const}:{}),
};
export default nextConfig;
