'use client';

/**
 * AdminPostsList - 管理画面用 投稿一覧（ページネーション・フィルター付き）
 *
 * 共通Paginationコンポーネントを使用して、
 * 管理画面用のテーブルライクなデザインで表示する。
 * カテゴリでフィルタリングが可能。
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Post, PostCategory } from '@/types';
import { DeletePostButton } from './DeletePostButton';
import { Pagination } from '@/components/Pagination';

interface AdminPostsListProps {
  posts: Post[];
}

type FilterCategory = 'all' | PostCategory;

const categoryLabels: Record<string, string> = {
  all: 'すべて',
  event: 'イベント',
  article: '記事',
  note: 'メモ',
  news: 'お知らせ',
};

const filterCategories: FilterCategory[] = ['all', 'note', 'article', 'event', 'news'];

export function AdminPostsList({ posts }: AdminPostsListProps) {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');

  // フィルタリングされた投稿
  const filteredPosts = useMemo(() => {
    if (selectedCategory === 'all') {
      return posts;
    }
    return posts.filter((post) => post.category === selectedCategory);
  }, [posts, selectedCategory]);

  // 各カテゴリの投稿数をカウント
  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: posts.length,
      event: 0,
      article: 0,
      note: 0,
      news: 0,
    };
    posts.forEach((post) => {
      counts[post.category]++;
    });
    return counts;
  }, [posts]);

  if (posts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ghost text-sm">まだ投稿がありません</p>
        <Link
          href="/posts/new"
          className="inline-block mt-4 text-xs text-ink underline hover:no-underline"
        >
          最初の投稿を作成
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* カテゴリフィルター */}
      <div className="flex flex-wrap gap-2">
        {filterCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs border rounded transition-all ${
              selectedCategory === cat
                ? 'bg-ink text-void border-ink'
                : 'bg-transparent text-ghost border-edge hover:border-ghost hover:text-ink'
            }`}
          >
            {categoryLabels[cat]}
            <span className="ml-1 opacity-60">({categoryCounts[cat]})</span>
          </button>
        ))}
      </div>

      {/* フィルター結果が0件の場合 */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-ghost text-sm">
            「{categoryLabels[selectedCategory]}」の投稿はありません
          </p>
        </div>
      ) : (
        <Pagination
          items={filteredPosts}
          itemsPerPageOptions={[5, 10, 50, 100]}
          defaultItemsPerPage={10}
          variant="default"
        >
          {(currentPosts) => (
            <div className="space-y-2">
              {currentPosts.map((post) => (
                <div
                  key={post.id}
                  className="content-frame p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* カテゴリバッジ */}
                      <span className="text-[10px] px-2 py-0.5 bg-edge text-ghost rounded">
                        {categoryLabels[post.category]}
                      </span>
                      {/* 公開状態 */}
                      {post.isPublished ? (
                        <span className="text-[10px] text-ink">公開中</span>
                      ) : (
                        <span className="text-[10px] text-ghost">下書き</span>
                      )}
                    </div>
                    {/* タイトル */}
                    <h2 className="text-sm font-medium text-ink truncate">
                      {post.title}
                    </h2>
                    {/* 日付 */}
                    <p className="text-xs text-ghost mt-1">
                      {new Date(post.date).toLocaleDateString('ja-JP')}
                    </p>
                  </div>

                  {/* アクション */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/posts/${post.id}`}
                      className="px-3 py-1 text-xs border border-edge text-ink rounded hover:border-ghost transition-colors"
                    >
                      編集
                    </Link>
                    <DeletePostButton id={post.id} title={post.title} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Pagination>
      )}
    </div>
  );
}
