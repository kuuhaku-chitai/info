'use client';

/**
 * 空白地帯 - ユーザー編集フォーム
 *
 * 表示名・アバター画像・パスワードを編集。
 * ImageUploader を再利用してアバターアップロード。
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { updateExistingUser } from '@/lib/actions';
import type { AdminUser } from '@/types';

interface UserFormProps {
  user: AdminUser;
}

export function UserForm({ user }: UserFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user.avatarUrl);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // パスワード確認
    if (newPassword && newPassword !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setError('パスワードは8文字以上にしてください');
      return;
    }

    startTransition(async () => {
      try {
        await updateExistingUser(user.id, {
          displayName,
          avatarUrl: avatarUrl ?? null,
          newPassword: newPassword || undefined,
        });

        setSuccess(true);
        setNewPassword('');
        setConfirmPassword('');
        router.refresh();
      } catch {
        setError('更新に失敗しました');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      {/* アバター画像 */}
      <ImageUploader
        postId={`users/${user.id}`}
        value={avatarUrl}
        onChange={(url) => setAvatarUrl(url)}
        label="アバター画像"
        aspectRatio={1}
        maxWidth={256}
        quality={0.85}
      />

      {/* 表示名 */}
      <div className="space-y-2">
        <label className="block text-xs text-ghost">表示名</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        />
      </div>

      {/* ユーザー名（読み取り専用） */}
      <div className="space-y-2">
        <label className="block text-xs text-ghost">ユーザー名</label>
        <input
          type="text"
          value={user.username}
          readOnly
          className="w-full px-3 py-2 text-sm text-ghost bg-edge/20 border border-edge rounded cursor-not-allowed"
        />
      </div>

      {/* パスワード変更 */}
      <div className="space-y-2">
        <label className="block text-xs text-ghost">
          新しいパスワード（変更する場合のみ）
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="空欄なら変更なし"
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        />
      </div>

      {newPassword && (
        <div className="space-y-2">
          <label className="block text-xs text-ghost">
            パスワード確認
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
          />
        </div>
      )}

      {/* エラー・成功メッセージ */}
      {error && (
        <p className="text-xs text-[var(--color-critical)]">{error}</p>
      )}
      {success && (
        <p className="text-xs text-ghost">更新しました</p>
      )}

      {/* ボタン */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? '保存中...' : '保存'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 border border-edge text-ink text-xs rounded hover:border-ghost transition-colors"
        >
          戻る
        </button>
      </div>
    </form>
  );
}
