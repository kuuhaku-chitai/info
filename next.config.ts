import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ローカル開発時のみ /images/* を MinIO にリライト
  // 本番では R2_PUBLIC_URL の絶対URLが使われるためリライト不要
  async rewrites() {
    if (process.env.NODE_ENV === 'production') {
      return [];
    }
    return [
      {
        source: '/images/:path*',
        destination: 'http://localhost:9000/kuuhaku-chitai-images/:path*',
      },
    ];
  },
};

export default nextConfig;
