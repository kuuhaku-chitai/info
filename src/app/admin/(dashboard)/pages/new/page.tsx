/**
 * 空白地帯 - 新規固定ページ
 *
 * 新しい固定ページを作成するフォーム。
 */

import Link from 'next/link';
import { PageForm } from '../PageForm';

export const dynamic = 'force-dynamic';

export default function NewPagePage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">新規ページ</h1>
          <p className="text-xs text-ghost mt-1">
            新しい固定ページを作成する
          </p>
        </div>
        <Link
          href="/pages"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </Link>
      </div>

      {/* フォーム */}
      <PageForm />
    </div>
  );
}
