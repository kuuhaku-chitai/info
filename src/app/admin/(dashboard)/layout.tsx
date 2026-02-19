/**
 * 空白地帯 - 管理画面ダッシュボードレイアウト
 *
 * 認証済みユーザーのみ表示されるレイアウト。
 * getSession() で D1 セッションを検証し、
 * 無効なら /login にリダイレクト。
 */

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { UserMenu } from './UserMenu';

/** サブドメインからメインサイトへのリンク用 */
const siteUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // D1 でセッション検証（認証ゲート）
  const user = await getSession();
  if (!user) {
    redirect('/login');
  }

  return (
    <>
      {/* 管理画面ヘッダー */}
      <header className="border-b border-[var(--color-edge)] px-6 py-4">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          <Link
            href="/"
            className="text-ink text-sm font-medium tracking-wide"
          >
            空白地帯 / 管理
          </Link>
          <div className="flex items-center gap-6">
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
                    href="/pages"
                    className="hover:text-ink transition-colors"
                  >
                    ページ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/projects"
                    className="hover:text-ink transition-colors"
                  >
                    プロジェクト
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
                  <Link
                    href="/inquiries"
                    className="hover:text-ink transition-colors"
                  >
                    問い合わせ
                  </Link>
                </li>
                <li>
                  <Link
                    href="/users"
                    className="hover:text-ink transition-colors"
                  >
                    ユーザー
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
            {/* ユーザーメニュー（アバター + ドロップダウン） */}
            <UserMenu user={{ displayName: user.displayName, avatarUrl: user.avatarUrl }} />
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {children}
      </main>
    </>
  );
}
