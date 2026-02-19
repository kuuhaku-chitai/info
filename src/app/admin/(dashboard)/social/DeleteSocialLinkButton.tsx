'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteExistingSocialLink } from '@/lib/actions';

interface DeleteSocialLinkButtonProps {
  id: string;
  title: string;
}

export function DeleteSocialLinkButton({ id, title }: DeleteSocialLinkButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm(`「${title}」を削除しますか？`)) return;

    startTransition(async () => {
      await deleteExistingSocialLink(id);
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-xs text-[var(--color-critical)] hover:underline disabled:opacity-50"
    >
      {isPending ? '削除中...' : '削除'}
    </button>
  );
}
