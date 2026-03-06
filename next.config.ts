import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3はネイティブモジュールのためバンドルから除外
  // 本番ではD1 REST APIを使うため影響なし
  serverExternalPackages: ['better-sqlite3'],

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
