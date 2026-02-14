/**
 * 空白地帯 - 問い合わせ詳細（管理画面）
 *
 * 問い合わせ全文表示。詳細表示時に自動で既読マーク。
 * 管理者メモ・返信済みマーク機能。
 */

import { notFound } from 'next/navigation';
import { fetchInquiryById, markInquiryAsRead } from '@/lib/actions';
import { InquiryActions } from './InquiryActions';

export const dynamic = 'force-dynamic';

/** 問い合わせ種別の日本語ラベル */
const TYPE_LABELS: Record<string, string> = {
  general: '一般的なお問い合わせ',
  collaboration: 'コラボレーション・協業',
  commission: '制作依頼',
  media: '取材・メディア関連',
  other: 'その他',
};

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const inquiry = await fetchInquiryById(id);

  if (!inquiry) {
    notFound();
  }

  // 未読なら自動で既読にする
  if (!inquiry.isRead) {
    await markInquiryAsRead(id);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      {/* ヘッダー */}
      <div>
        <h1 className="text-lg font-medium text-ink tracking-wide">
          問い合わせ詳細
        </h1>
        <p className="text-xs text-ghost mt-1">
          {new Date(inquiry.createdAt).toLocaleString('ja-JP')}
        </p>
      </div>

      {/* 問い合わせ情報 */}
      <div className="space-y-3">
        <div className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <span className="text-ghost">お名前</span>
          <span className="text-ink">{inquiry.name}</span>

          <span className="text-ghost">メール</span>
          <a
            href={`mailto:${inquiry.email}`}
            className="text-ink hover:underline"
          >
            {inquiry.email}
          </a>

          {inquiry.phone && (
            <>
              <span className="text-ghost">電話</span>
              <span className="text-ink">{inquiry.phone}</span>
            </>
          )}

          {inquiry.organization && (
            <>
              <span className="text-ghost">団体名</span>
              <span className="text-ink">{inquiry.organization}</span>
            </>
          )}

          <span className="text-ghost">種別</span>
          <span className="text-ink">
            {TYPE_LABELS[inquiry.inquiryType] || inquiry.inquiryType}
          </span>

          <span className="text-ghost">状態</span>
          <span className="text-ink">
            {inquiry.isReplied ? '返信済' : '未返信'}
          </span>
        </div>
      </div>

      {/* 問い合わせ内容 */}
      <div className="border border-edge rounded p-4">
        <p className="text-xs text-ghost mb-2">お問い合わせ内容</p>
        <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed">
          {inquiry.message}
        </p>
      </div>

      {/* 管理者アクション（Client Component） */}
      <InquiryActions inquiry={inquiry} />

      {/* 戻るリンク */}
      <div className="pt-4 border-t border-edge">
        <a
          href="/inquiries"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </a>
      </div>
    </div>
  );
}
