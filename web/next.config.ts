import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@marketplace/core'],
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: 'placehold.co' }]
  }
};

export default nextConfig;
