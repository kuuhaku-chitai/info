'use client';

/**
 * 空白地帯 - 問い合わせアクション
 *
 * 管理者メモ保存・返信済みマーク。
 */

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { markInquiryAsRead, markInquiryAsReplied, updateInquiryNote } from '@/lib/actions';
import type { ContactInquiry } from '@/types';

interface InquiryActionsProps {
  inquiry: ContactInquiry;
}

export function InquiryActions({ inquiry }: InquiryActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [note, setNote] = useState(inquiry.adminNote || '');
  const [success, setSuccess] = useState<string | null>(null);

  // マウント時に未読なら既読にする
  useEffect(() => {
    if (!inquiry.isRead) {
      markInquiryAsRead(inquiry.id).then(() => {
        router.refresh();
      });
    }
  }, [inquiry.id, inquiry.isRead, router]);

  function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);

    startTransition(async () => {
      await updateInquiryNote(inquiry.id, note);
      setSuccess('メモを保存しました');
      router.refresh();
    });
  }

  function handleMarkReplied() {
    setSuccess(null);

    startTransition(async () => {
      await markInquiryAsReplied(inquiry.id);
      setSuccess('返信済みにしました');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* 管理者メモ */}
      <form onSubmit={handleSaveNote} className="space-y-2">
        <label className="block text-xs text-ghost">管理者メモ</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors resize-y"
          placeholder="内部メモ（送信者には表示されません）"
        />
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? '保存中...' : 'メモを保存'}
        </button>
      </form>

      {/* 返信済みマーク */}
      {!inquiry.isReplied && (
        <button
          type="button"
          onClick={handleMarkReplied}
          disabled={isPending}
          className="px-4 py-2 border border-edge text-ink text-xs rounded hover:border-ghost transition-colors disabled:opacity-50"
        >
          返信済みにする
        </button>
      )}

      {/* 成功メッセージ */}
      {success && (
        <p className="text-xs text-ghost">{success}</p>
      )}
    </div>
  );
}
