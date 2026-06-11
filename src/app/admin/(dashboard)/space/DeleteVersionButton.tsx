'use client';

/**
 * 空白地帯 - バージョン削除ボタン
 *
 * 確認ダイアログ付き。削除するとエッジ・画像もCASCADEで連鎖削除される。
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteExistingVersionRecord } from '@/lib/actions';

interface DeleteVersionButtonProps {
  id: string;
}

export function DeleteVersionButton({ id }: DeleteVersionButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteExistingVersionRecord(id);
      setShowConfirm(false);
      router.refresh();
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
