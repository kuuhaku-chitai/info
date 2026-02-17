/**
 * 空白地帯 - 固定ページ編集
 *
 * 既存の固定ページを編集するページ。
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchPageById } from '@/lib/actions';
import { PageForm } from '../PageForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditPagePage({ params }: PageProps) {
  const { id } = await params;
  const page = await fetchPageById(id);

  if (!page) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">ページを編集</h1>
          <p className="text-xs text-ghost mt-1">
            {page.title}
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
      <PageForm page={page} />
    </div>
  );
}
