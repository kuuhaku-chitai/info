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

import Link from 'next/link';
import type { Post } from '@/types';
import { Pagination } from '@/components/Pagination';

interface BlogListViewProps {
  posts: Post[];
}

export function BlogListView({ posts }: BlogListViewProps) {
  const categoryLabels: Record<string, string> = {
    article: '記事',
    note: 'メモ',
    event: 'イベント',
  };

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
          <div className="max-w-2xl mx-auto fade-in-slow">
            <Pagination
              items={posts}
              itemsPerPageOptions={[5, 10, 50]}
              defaultItemsPerPage={5}
              variant="minimal"
            >
              {(currentPosts) => (
                <ul className="space-y-[var(--space-md)]">
                  {currentPosts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/post/${post.id}`}
                        className="group block p-[var(--space-md)] border border-transparent hover:border-[var(--color-edge)] transition-all duration-[var(--duration-subtle)]"
                        style={{
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
              )}
            </Pagination>
          </div>
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
