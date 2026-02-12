'use client';

/**
 * 空白地帯 - 入金削除ボタン
 *
 * 確認ダイアログ付きの削除ボタン。
 * 入金を削除すると延命も取り消される。
 */

import { useState, useTransition } from 'react';
import { deleteExistingDonation } from '@/lib/actions';

interface DeleteDonationButtonProps {
  id: string;
  amount: number;
}

export function DeleteDonationButton({ id, amount }: DeleteDonationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDelete = () => {
    startTransition(async () => {
      await deleteExistingDonation(id);
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
      title="削除すると延命も取り消されます"
    >
      削除
    </button>
  );
}
