'use client';

/**
 * BlogContent - ブログ3D空間のクライアントラッパー
 *
 * Server Componentで取得したデータを受け取り、
 * 3D物理空間として描画する。
 * 「都市に吊るされた思考の断片」のインスタレーション。
 */

import { Suspense } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Post } from '@/types';

// Blog3DSceneは動的インポート（SSRを避ける）
// R3F/Rapierはサーバーサイドでは動作しない
const Blog3DScene = dynamic(
  () => import('@/components/blog3d/Blog3DScene').then((mod) => mod.Blog3DScene),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-void)]">
        <span className="text-ghost text-xs animate-pulse">...</span>
      </div>
    ),
  }
);

interface BlogContentProps {
  posts: Post[];
}

export function BlogContent({ posts }: BlogContentProps) {
  return (
    <div className="relative min-h-screen">
      {/* 3D物理空間: 記事が天井から吊るされている */}
      <Blog3DScene posts={posts} />

      {/* UIオーバーレイ: 3D空間の上に配置 */}
      <div className="pointer-events-none fixed inset-0 z-10">
        {/* ヘッダー */}
        <header className="pointer-events-auto hug-corner-tl">
          <Link
            href="/"
            className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors duration-[var(--duration-subtle)]"
          >
            空白地帯
          </Link>
        </header>

        {/* タイトル: 微かに上部中央に */}
        <div className="absolute top-[var(--space-lg)] left-1/2 -translate-x-1/2">
          <h1 className="text-ghost text-sm tracking-[0.3em] font-light fade-in-slow">
            記録
          </h1>
        </div>

        {/* 記事がない場合のメッセージ */}
        {posts.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-ghost text-xs opacity-50 fade-in-slow">
              まだ何も書かれていない。
            </p>
          </div>
        )}

        {/* 戻るリンク */}
        <nav className="pointer-events-auto hug-corner-bl">
          <Link
            href="/"
            className="text-xs text-ghost hover:text-ink transition-colors duration-[var(--duration-subtle)]"
          >
            ← 戻る
          </Link>
        </nav>

        {/* 操作ヒント */}
        <div className="absolute bottom-[var(--space-lg)] right-[var(--space-lg)]">
          <p className="text-[10px] text-ghost opacity-30">
            ドラッグで視点を微調整
          </p>
        </div>
      </div>
    </div>
  );
}
