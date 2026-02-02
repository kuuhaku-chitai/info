/**
 * 空白地帯 - 投稿一覧ページ（管理画面）
 *
 * すべての投稿を一覧表示し、編集・削除を行う。
 * 公開状態、カテゴリでフィルタリング可能。
 */

import Link from 'next/link';
import { fetchAllPosts } from '@/lib/actions';
import { DeletePostButton } from './DeletePostButton';

export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const posts = await fetchAllPosts();

  // カテゴリの日本語表示
  const categoryLabels = {
    event: 'イベント',
    article: '記事',
    note: 'メモ',
  };

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">投稿一覧</h1>
          <p className="text-xs text-ghost mt-1">
            {posts.length}件の投稿
          </p>
        </div>
        <Link
          href="/admin/posts/new"
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
        >
          新規投稿
        </Link>
      </div>

      {/* 投稿一覧 */}
      {posts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ghost text-sm">まだ投稿がありません</p>
          <Link
            href="/admin/posts/new"
            className="inline-block mt-4 text-xs text-ink underline hover:no-underline"
          >
            最初の投稿を作成
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
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
                  href={`/admin/posts/${post.id}`}
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
    </div>
  );
}
