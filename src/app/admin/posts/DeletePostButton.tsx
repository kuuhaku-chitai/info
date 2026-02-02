'use client';

/**
 * 空白地帯 - 投稿削除ボタン
 *
 * 確認ダイアログ付きの削除ボタン。
 * 「消去」という行為も慎重に行う。
 */

import { useState, useTransition } from 'react';
import { deleteExistingPost } from '@/lib/actions';

interface DeletePostButtonProps {
  id: string;
  title: string;
}

export function DeletePostButton({ id, title }: DeletePostButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteExistingPost(id);
      setShowConfirm(false);
    });
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="px-2 py-1 text-xs bg-[var(--color-critical)] text-void rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? '...' : '削除'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={isPending}
          className="px-2 py-1 text-xs border border-edge text-ghost rounded hover:border-ghost transition-colors"
        >
          取消
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="px-3 py-1 text-xs text-ghost hover:text-[var(--color-critical)] transition-colors"
    >
      削除
    </button>
  );
}
