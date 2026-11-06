import type { NextConfig } from 'next';

const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';

// El navegador llama a /api/... en el mismo dominio y Next lo reenvía al backend.
const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backendUrl}/api/:path*` }];
  },
};

export default nextConfig;
