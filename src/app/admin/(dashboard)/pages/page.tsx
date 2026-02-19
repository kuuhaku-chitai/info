/**
 * 空白地帯 - 固定ページ一覧
 *
 * 管理画面での固定ページ管理。
 * タイトル、パス、公開状態、表示順を一覧表示。
 */

import Link from 'next/link';
import { fetchAllPages } from '@/lib/actions';
import { DeletePageButton } from './DeletePageButton';

export const dynamic = 'force-dynamic';

export default async function PagesPage() {
  const pages = await fetchAllPages();

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">固定ページ一覧</h1>
          <p className="text-xs text-ghost mt-1">
            {pages.length}件のページ
          </p>
        </div>
        <Link
          href="/pages/new"
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
        >
          新規ページ
        </Link>
      </div>

      {/* ページ一覧 */}
      {pages.length === 0 ? (
        <p className="text-sm text-ghost py-8 text-center">
          まだ固定ページがありません
        </p>
      ) : (
        <div className="border border-edge rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge bg-void">
                <th className="text-left px-4 py-3 text-xs text-ghost font-normal">タイトル</th>
                <th className="text-left px-4 py-3 text-xs text-ghost font-normal">パス</th>
                <th className="text-left px-4 py-3 text-xs text-ghost font-normal">順序</th>
                <th className="text-left px-4 py-3 text-xs text-ghost font-normal">状態</th>
                <th className="text-right px-4 py-3 text-xs text-ghost font-normal">操作</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => (
                <tr key={page.id} className="border-b border-edge last:border-b-0 hover:bg-[var(--color-void)]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/pages/${page.id}`}
                      className="text-ink hover:opacity-70 transition-opacity"
                    >
                      {page.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-ghost">
                    /{page.path}
                  </td>
                  <td className="px-4 py-3 text-xs text-ghost">
                    {page.sortOrder}
                  </td>
                  <td className="px-4 py-3">
                    {page.isPublished ? (
                      <span className="text-xs text-green-600">公開中</span>
                    ) : (
                      <span className="text-xs text-ghost">下書き</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/pages/${page.id}`}
                        className="px-3 py-1 text-xs text-ghost hover:text-ink transition-colors"
                      >
                        編集
                      </Link>
                      <DeletePageButton id={page.id} title={page.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
