import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: '/images/:path*',
        destination: 'http://localhost:9000/kuuhaku-chitai-images/:path*',
      },
    ];
  },
};

export default nextConfig;
