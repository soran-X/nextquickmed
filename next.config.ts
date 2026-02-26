import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Supabase storage (local dev)
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // Supabase storage (production)
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // CDN images / placeholder
        protocol: 'https',
        hostname: 'cdnjs.cloudflare.com',
      },
    ],
  },
};

export default nextConfig;
