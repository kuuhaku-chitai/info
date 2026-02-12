/**
 * 空白地帯 - 投稿編集ページ
 *
 * 既存の投稿を編集するページ。
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchPostById, fetchAllProjects } from '@/lib/actions';
import { PostForm } from '../PostForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPostPage({ params }: PageProps) {
  const { id } = await params;
  const [post, projects] = await Promise.all([
    fetchPostById(id),
    fetchAllProjects(),
  ]);

  if (!post) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">投稿を編集</h1>
          <p className="text-xs text-ghost mt-1">
            {post.title}
          </p>
        </div>
        <Link
          href="/posts"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </Link>
      </div>

      {/* フォーム */}
      <PostForm post={post} projects={projects} />
    </div>
  );
}
