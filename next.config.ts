import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3はネイティブモジュールのためバンドルから除外
  // 本番ではD1 REST APIを使うため影響なし
  serverExternalPackages: ['better-sqlite3'],

  // Turbopack のワークスペースルートを明示
  // 〜/package-lock.json が存在するため Next.js が誤検出するのを抑止
  // next.config.ts は ESM のため __dirname 不可、process.cwd() で代替
  turbopack: {
    root: process.cwd(),
  },

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
