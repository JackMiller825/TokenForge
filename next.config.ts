import type { NextConfig } from 'next';

const staticExport = process.env.STATIC_EXPORT === '1';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  serverExternalPackages: ['playwright', 'playwright-core', 'archiver', 'sharp'],
  ...(staticExport
    ? { output: 'export', basePath, assetPrefix: basePath || undefined, images: { unoptimized: true }, trailingSlash: true }
    : {
        async headers() {
          return [{
            source: '/:path*',
            headers: [
              { key: 'X-Content-Type-Options', value: 'nosniff' },
              { key: 'Referrer-Policy', value: 'no-referrer' },
              { key: 'X-Frame-Options', value: 'DENY' },
              { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
            ],
          }];
        },
      }),
};

export default nextConfig;
