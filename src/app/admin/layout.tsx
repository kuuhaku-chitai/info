/**
 * 空白地帯 - 管理画面レイアウト
 *
 * 管理画面は「空白」のコンセプトから離れ、
 * 機能性を優先したシンプルなレイアウトを採用。
 * ただし、過度な装飾は避ける。
 *
 * Phase 1: 基本レイアウト
 * Phase 2: 認証機能を追加
 */

import Link from 'next/link';

export const metadata = {
  title: '管理',
  robots: {
    index: false,
    follow: false,
  },
};

/** サブドメインからメインサイトへのリンク用 */
const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-void)]">
      {/* 管理画面ヘッダー */}
      <header className="border-b border-[var(--color-edge)] px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-ink text-sm font-medium tracking-wide"
          >
            空白地帯 / 管理
          </Link>
          <nav>
            <ul className="flex gap-6 text-xs text-ghost">
              <li>
                <Link
                  href="/"
                  className="hover:text-ink transition-colors"
                >
                  ダッシュボード
                </Link>
              </li>
              <li>
                <Link
                  href="/posts"
                  className="hover:text-ink transition-colors"
                >
                  投稿
                </Link>
              </li>
              <li>
                <Link
                  href="/donations"
                  className="hover:text-ink transition-colors"
                >
                  入金
                </Link>
              </li>
              <li>
                <Link
                  href="/social"
                  className="hover:text-ink transition-colors"
                >
                  ソーシャル
                </Link>
              </li>
              <li>
                <a
                  href={siteUrl}
                  className="hover:text-ink transition-colors"
                >
                  サイトへ
                </a>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
