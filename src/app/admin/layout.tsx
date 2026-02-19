/**
 * 空白地帯 - 管理画面ルートレイアウト
 *
 * 認証済みページ・ログインページ共通の最小ラッパー。
 * ナビゲーションは (dashboard)/layout.tsx に配置。
 */

export const metadata = {
  title: '管理',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[var(--color-void)]">
      {children}
    </div>
  );
}
