import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  typescript: { tsconfigPath: 'tsconfig.app.json' },
  poweredByHeader: false,
  ...(process.env.YOGO_STATIC_EXPORT==='1'?{output:'export' as const}:{}),
};
export default nextConfig;
