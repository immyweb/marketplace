import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "placehold.co" }],
  },
  experimental: {
    preloadEntriesOnStart: false,
  },
};

export default nextConfig;
