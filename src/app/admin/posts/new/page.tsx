/**
 * 空白地帯 - 新規投稿ページ
 *
 * 新しい投稿を作成するフォーム。
 * シンプルなMarkdownエディタとメタデータ入力。
 */

import Link from 'next/link';
import { PostForm } from '../PostForm';

export default function NewPostPage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">新規投稿</h1>
          <p className="text-xs text-ghost mt-1">
            新しい記録を残す
          </p>
        </div>
        <Link
          href="/admin/posts"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </Link>
      </div>

      {/* フォーム */}
      <PostForm />
    </div>
  );
}
