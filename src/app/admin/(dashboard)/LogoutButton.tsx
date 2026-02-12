'use client';

/**
 * ログアウトボタン
 *
 * 管理画面ヘッダーに配置。
 * POST /api/auth/logout を呼び出してセッションを破棄する。
 */

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className="text-xs text-ghost hover:text-ink transition-colors disabled:opacity-50"
    >
      {isLoading ? '...' : 'ログアウト'}
    </button>
  );
}
