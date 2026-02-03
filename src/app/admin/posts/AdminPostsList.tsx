'use client';

/**
 * AdminPostsList - 管理画面用 投稿一覧（ページネーション付き）
 *
 * 共通Paginationコンポーネントを使用して、
 * 管理画面用のテーブルライクなデザインで表示する。
 */

import Link from 'next/link';
import type { Post } from '@/types';
import { DeletePostButton } from './DeletePostButton';
import { Pagination } from '@/components/Pagination';

interface AdminPostsListProps {
    posts: Post[];
}

export function AdminPostsList({ posts }: AdminPostsListProps) {
    const categoryLabels: Record<string, string> = {
        event: 'イベント',
        article: '記事',
        note: 'メモ',
    };

    if (posts.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-ghost text-sm">まだ投稿がありません</p>
                <Link
                    href="/admin/posts/new"
                    className="inline-block mt-4 text-xs text-ink underline hover:no-underline"
                >
                    最初の投稿を作成
                </Link>
            </div>
        );
    }

    return (
        <Pagination
            items={posts}
            itemsPerPageOptions={[5, 10, 50, 100]}
            defaultItemsPerPage={5}
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
        </Pagination>
    );
}
