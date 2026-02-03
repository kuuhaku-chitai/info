
import Link from 'next/link';
import { fetchAllPosts } from '@/lib/actions';
import { AdminPostsList } from './AdminPostsList';

export const dynamic = 'force-dynamic';

export default async function PostsPage() {
  const posts = await fetchAllPosts();

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

      {/* 投稿一覧（ページネーション付き） */}
      <AdminPostsList posts={posts} />
    </div>
  );
}
