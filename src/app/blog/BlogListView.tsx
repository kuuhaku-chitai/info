'use client';

/**
 * BlogListView - シンプルな記事一覧表示
 *
 * インスタレーションモードの対極として、
 * 最小限の要素で記事を一覧表示する。
 * 「空白地帯」のコンセプトを維持しつつ、
 * 読みやすさを優先した静的なリスト。
 *
 * ページネーション: 5件/10件/50件から選択可能（デフォルト: 5件）
 */

import { useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Post } from '@/types';

// 表示件数のオプション
const ITEMS_PER_PAGE_OPTIONS = [5, 10, 50] as const;
type ItemsPerPage = (typeof ITEMS_PER_PAGE_OPTIONS)[number];

interface BlogListViewProps {
  posts: Post[];
}

export function BlogListView({ posts }: BlogListViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const categoryLabels: Record<string, string> = {
    article: '記事',
    note: 'メモ',
    event: 'イベント',
  };

  // URLから表示件数を取得（デフォルト: 5）
  const itemsPerPage = useMemo<ItemsPerPage>(() => {
    const limitParam = searchParams.get('limit');
    if (!limitParam) return 5;

    const limit = parseInt(limitParam, 10);
    // 有効なオプションかチェック（型安全のため）
    const isValidOption = ITEMS_PER_PAGE_OPTIONS.some(opt => opt === limit);
    return isValidOption ? (limit as ItemsPerPage) : 5;
  }, [searchParams]);

  // URLから現在のページを取得（デフォルト: 1）
  const currentPage = useMemo(() => {
    const pageParam = searchParams.get('page');
    if (!pageParam) return 1;

    const page = parseInt(pageParam, 10);
    return Math.max(1, page);
  }, [searchParams]);

  // 総ページ数
  const totalPages = useMemo(
    () => Math.ceil(posts.length / itemsPerPage),
    [posts.length, itemsPerPage]
  );

  // 現在のページの記事
  const currentPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return posts.slice(startIndex, endIndex);
  }, [posts, currentPage, itemsPerPage]);

  // 表示件数変更時にページをリセットしてURL更新
  const handleItemsPerPageChange = useCallback((newItemsPerPage: ItemsPerPage) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('limit', newItemsPerPage.toString());
    params.set('page', '1'); // 件数変更時は1ページ目に戻す

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  // ページ変更時にURL更新
  const goToPage = useCallback((page: number) => {
    const targetPage = Math.max(1, Math.min(page, totalPages));
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', targetPage.toString());

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams, totalPages]);

  return (
    <div className="min-h-screen bg-[var(--color-void)]">
      {/* ヘッダー */}
      <header className="hug-corner-tl">
        <Link
          href="/"
          className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          空白地帯
        </Link>
      </header>

      {/* メインコンテンツ */}
      <main className="pt-[calc(var(--space-lg)*3)] pb-[calc(var(--space-lg)*3)] px-[var(--space-lg)]">
        {/* タイトル */}
        <h1 className="text-ghost text-sm tracking-[0.3em] font-light mb-[var(--space-lg)] fade-in-slow text-center">
          記録
        </h1>

        {/* 記事リスト */}
        {posts.length === 0 ? (
          <div className="flex items-center justify-center min-h-[50vh]">
            <p className="text-ghost text-xs opacity-50 fade-in-slow">
              まだ何も書かれていない。
            </p>
          </div>
        ) : (
          <>
            {/* 表示件数セレクター */}
            <div className="max-w-2xl mx-auto mb-[var(--space-md)] flex justify-end items-center gap-2 fade-in-slow">
              <span className="text-[10px] text-ghost opacity-50">表示</span>
              <div className="flex gap-1">
                {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    onClick={() => handleItemsPerPageChange(option)}
                    className={`px-2 py-1 text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${itemsPerPage === option
                      ? 'text-ink border-b border-[var(--color-edge)]'
                      : 'text-ghost opacity-50 hover:opacity-100'
                      }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
              <span className="text-[10px] text-ghost opacity-50">件</span>
            </div>

            {/* 記事一覧 */}
            <ul className="max-w-2xl mx-auto space-y-[var(--space-md)] fade-in-slow">
              {currentPosts.map((post) => (
                <li key={post.id}>
                  <Link
                    href={`/post/${post.id}`}
                    className="group block p-[var(--space-md)] border border-transparent hover:border-[var(--color-edge)] transition-all duration-[var(--duration-subtle)]"
                    style={{
                      // 「未完の台形」を微かに表現
                      clipPath: 'polygon(0% 0%, 100% 1%, 99% 100%, 1% 99%)',
                    }}
                  >
                    {/* メタ情報 */}
                    <div className="flex items-center gap-3 mb-2">
                      <time className="text-[10px] text-ghost tracking-wider">
                        {new Date(post.date).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                      <span className="text-[10px] text-ghost opacity-50">
                        {categoryLabels[post.category]}
                      </span>
                    </div>

                    {/* タイトル */}
                    <h2 className="text-sm font-light text-ink tracking-wide leading-relaxed group-hover:text-ghost transition-colors duration-[var(--duration-subtle)]">
                      {post.title}
                    </h2>

                    {/* 抜粋 */}
                    {post.markdown && (
                      <p className="text-xs text-ghost mt-2 line-clamp-2 leading-relaxed opacity-60">
                        {post.markdown.slice(0, 100)}
                        {post.markdown.length > 100 && '...'}
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>

            {/* ページネーション */}
            {totalPages > 1 && (
              <nav className="max-w-2xl mx-auto mt-[var(--space-lg)] flex justify-center items-center gap-4 fade-in-slow">
                {/* 前へ */}
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${currentPage === 1
                    ? 'text-ghost opacity-20 cursor-not-allowed'
                    : 'text-ghost hover:text-ink'
                    }`}
                >
                  ← 前へ
                </button>

                {/* ページ番号 */}
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // 表示するページ番号を制限（現在のページの前後2ページまで）
                    const showPage =
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 1;

                    // 省略記号を表示するかどうか
                    const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                    const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                    if (!showPage && !showEllipsisBefore && !showEllipsisAfter) {
                      return null;
                    }

                    if (showEllipsisBefore || showEllipsisAfter) {
                      return (
                        <span key={`ellipsis-${page}`} className="text-[10px] text-ghost opacity-30">
                          ...
                        </span>
                      );
                    }

                    return (
                      <button
                        key={page}
                        onClick={() => goToPage(page)}
                        className={`w-6 h-6 text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${currentPage === page
                          ? 'text-ink border border-[var(--color-edge)]'
                          : 'text-ghost opacity-50 hover:opacity-100'
                          }`}
                        style={{
                          clipPath: 'polygon(5% 0%, 100% 5%, 95% 100%, 0% 95%)',
                        }}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                {/* 次へ */}
                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${currentPage === totalPages
                    ? 'text-ghost opacity-20 cursor-not-allowed'
                    : 'text-ghost hover:text-ink'
                    }`}
                >
                  次へ →
                </button>
              </nav>
            )}

            {/* 記事数の表示 */}
            <div className="max-w-2xl mx-auto mt-[var(--space-md)] text-center">
              <span className="text-[10px] text-ghost opacity-30">
                {posts.length}件中 {(currentPage - 1) * itemsPerPage + 1}-
                {Math.min(currentPage * itemsPerPage, posts.length)}件を表示
              </span>
            </div>
          </>
        )}
      </main>

      {/* 戻るリンク */}
      <nav className="hug-corner-bl">
        <Link
          href="/"
          className="text-xs text-ghost hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          ← 戻る
        </Link>
      </nav>
    </div>
  );
}
