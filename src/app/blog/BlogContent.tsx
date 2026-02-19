'use client';

/**
 * BlogContent - ブログのメインコンテナ
 *
 * 2つのモードを提供:
 * - list: シンプルな記事一覧（デフォルト、モバイル専用）
 * - installation: 3D物理空間「天井から吊るされた思考の断片」（PC専用）
 *
 * モバイルではリストモードのみ表示し、
 * 3D関連のファイル（GLB、R3F、Rapier）を一切読み込まない設計。
 */

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { Post, SocialLink, Page } from '@/types';
import { DesktopNav } from '@/components/ui/DesktopNav';
import { BlogListView } from './BlogListView';

// Blog3DSceneは動的インポート（SSRを避ける）
// PCでインスタレーションモードを選択した場合のみ読み込む
const Blog3DScene = dynamic(
  () => import('@/components/blog3d/Blog3DScene').then((mod) => mod.Blog3DScene),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-void)]">
        <span className="text-ghost text-[10px] tracking-[0.4em] font-light uppercase animate-pulse-whisper">
          Initializing Space
        </span>
      </div>
    ),
  }
);

type ViewMode = 'list' | 'installation';

interface BlogContentProps {
  posts: Post[];
  socialLinks?: SocialLink[];
  pages?: Page[];
}

/**
 * モバイル判定フック
 * タッチデバイスまたは画面幅768px未満をモバイルと判定
 */
function useIsMobile(): boolean | null {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    function checkMobile(): boolean {
      // タッチデバイス判定
      const hasTouchScreen =
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0;

      // 画面幅判定（768px未満）
      const isNarrowScreen = window.innerWidth < 768;

      // どちらかに該当すればモバイル
      return hasTouchScreen || isNarrowScreen;
    }

    setIsMobile(checkMobile());

    // リサイズ時の再判定（PCでウィンドウを狭くした場合など）
    function handleResize() {
      setIsMobile(checkMobile());
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
}

export function BlogContent({ posts, socialLinks = [], pages = [] }: BlogContentProps) {
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // モード切り替えハンドラ
  const toggleMode = useCallback(() => {
    setViewMode((prev) => prev === 'list' ? 'installation' : 'list');
  }, []);

  // 初期ロード中（モバイル判定前）
  if (isMobile === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[var(--color-void)]">
        <span className="text-ghost text-xs animate-pulse">...</span>
      </div>
    );
  }

  // モバイルの場合はリストモードのみ
  if (isMobile) {
    return <BlogListView posts={posts} socialLinks={socialLinks} pages={pages} />;
  }

  // PCの場合: モード切り替え可能
  return (
    <div className="relative min-h-screen">
      {/* リストモード */}
      {viewMode === 'list' && <BlogListView posts={posts} socialLinks={socialLinks} pages={pages} />}

      {/* インスタレーションモード（3D空間） */}
      {viewMode === 'installation' && (
        <>
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

            {/* タイトル */}
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

            {/* ナビゲーション */}
            <div className="pointer-events-auto">
              <DesktopNav variant="corner" pages={pages} />
            </div>

            {/* 操作ヒント */}
            <div className="absolute bottom-[var(--space-lg)] left-1/2 -translate-x-1/2">
              <p className="text-[10px] text-ghost opacity-30">
                ドラッグで視点を微調整
              </p>
            </div>
          </div>
        </>
      )}

      {/* モード切り替えボタン（PC専用） */}
      <button
        onClick={toggleMode}
        className="fixed bottom-[var(--space-lg)] right-[var(--space-lg)] z-30 group"
        aria-label={viewMode === 'list' ? 'インスタレーションモードに切り替え' : 'リストモードに切り替え'}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-void)] border border-[var(--color-edge)] transition-all duration-[var(--duration-subtle)] group-hover:border-[var(--color-ghost)]"
          style={{
            // 「未完の台形」を維持
            clipPath: 'polygon(2% 0%, 100% 1%, 98% 100%, 0% 99%)',
          }}
        >
          {/* アイコン */}
          <span className="text-ghost text-xs opacity-60 group-hover:opacity-100 transition-opacity">
            {viewMode === 'list' ? '◇' : '≡'}
          </span>
          {/* ラベル */}
          <span className="text-[10px] text-ghost tracking-wider group-hover:text-ink transition-colors">
            {viewMode === 'list' ? 'INSTALLATION' : 'LIST'}
          </span>
        </div>
      </button>

    </div>
  );
}
