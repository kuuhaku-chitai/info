'use client';

/**
 * 空白地帯 - 固定ページ削除ボタン
 *
 * 確認ダイアログ付きの削除ボタン。
 */

import { useState, useTransition } from 'react';
import { deleteExistingPage } from '@/lib/actions';

interface DeletePageButtonProps {
  id: string;
  title: string;
}

export function DeletePageButton({ id, title }: DeletePageButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteExistingPage(id);
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
