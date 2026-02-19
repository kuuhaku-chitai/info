'use client';

/**
 * 空白地帯 - ログインページ
 *
 * 管理画面への入り口。空白地帯の美学を維持した最小限のフォーム。
 * 認証情報は POST /api/auth/login に送信。
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        // ログイン成功: ダッシュボードへ遷移
        router.push('/');
        router.refresh();
      } else {
        setError('認証情報が正しくありません');
      }
    } catch {
      setError('接続エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen px-6">
      <div className="w-full max-w-xs">
        {/* タイトル: 微かに存在する */}
        <h1 className="text-xs text-ghost tracking-[0.3em] text-center mb-12">
          管理
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ユーザー名"
              required
              autoComplete="username"
              className="w-full bg-transparent border-b border-[var(--color-edge)] px-0 py-2 text-sm text-ink placeholder:text-ghost/50 focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="パスワード"
              required
              autoComplete="current-password"
              className="w-full bg-transparent border-b border-[var(--color-edge)] px-0 py-2 text-sm text-ink placeholder:text-ghost/50 focus:outline-none focus:border-ink transition-colors"
            />
          </div>

          {error && (
            <p className="text-xs text-ghost text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 text-xs text-ghost border border-[var(--color-edge)] hover:text-ink hover:border-ink transition-colors disabled:opacity-50"
          >
            {isLoading ? '...' : '入る'}
          </button>
        </form>
      </div>
    </div>
  );
}
