/**
 * 空白地帯 - ソーシャルリンク管理ページ
 */

import Link from 'next/link';
import Image from 'next/image';
import { fetchAllSocialLinks } from '@/lib/actions';
import { DeleteSocialLinkButton } from './DeleteSocialLinkButton';

export const dynamic = 'force-dynamic';

export default async function SocialLinksPage() {
  const links = await fetchAllSocialLinks();

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">ソーシャルリンク</h1>
          <p className="text-xs text-ghost mt-1">
            {links.length}件のリンク
          </p>
        </div>
        <Link
          href="/social/new"
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
        >
          新規追加
        </Link>
      </div>

      {/* リンク一覧 */}
      {links.length === 0 ? (
        <div className="text-center py-12 text-ghost text-sm">
          ソーシャルリンクはまだありません
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex items-center gap-4 p-4 border border-edge rounded hover:border-ghost transition-colors"
            >
              {/* アイコン */}
              <div className="relative w-10 h-10 flex-shrink-0 rounded overflow-hidden bg-edge">
                <Image
                  src={link.iconUrl}
                  alt={link.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* 情報 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-ink font-medium">
                    {link.title}
                  </span>
                  <span className="text-[10px] text-ghost">
                    順序: {link.sortOrder}
                  </span>
                </div>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-ghost hover:text-ink truncate block"
                >
                  {link.url}
                </a>
              </div>

              {/* アクション */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <Link
                  href={`/social/${link.id}`}
                  className="text-xs text-ghost hover:text-ink"
                >
                  編集
                </Link>
                <DeleteSocialLinkButton id={link.id} title={link.title} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
