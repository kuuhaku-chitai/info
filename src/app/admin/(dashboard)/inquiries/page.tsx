/**
 * 空白地帯 - 問い合わせ一覧（管理画面）
 *
 * 受信した問い合わせを一覧表示。
 * 未読は太字で区別する。
 */

import Link from 'next/link';
import { fetchInquiries } from '@/lib/actions';

export const dynamic = 'force-dynamic';

/** 問い合わせ種別の日本語ラベル */
const TYPE_LABELS: Record<string, string> = {
  general: '一般',
  collaboration: 'コラボ',
  commission: '依頼',
  media: '取材',
  other: 'その他',
};

export default async function InquiriesPage() {
  const inquiries = await fetchInquiries();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-ink tracking-wide">
          問い合わせ
        </h1>
        <p className="text-xs text-ghost mt-1">
          {inquiries.filter((i) => !i.isRead).length}件の未読
        </p>
      </div>

      {inquiries.length === 0 ? (
        <p className="text-xs text-ghost">問い合わせはありません</p>
      ) : (
        <div className="space-y-1">
          {inquiries.map((inquiry) => (
            <Link
              key={inquiry.id}
              href={`/inquiries/${inquiry.id}`}
              className="block p-4 border border-edge rounded hover:border-ghost transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {/* 未読マーク */}
                    {!inquiry.isRead && (
                      <span className="w-1.5 h-1.5 rounded-full bg-ink flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm truncate ${
                        inquiry.isRead ? 'text-ghost' : 'text-ink font-medium'
                      }`}
                    >
                      {inquiry.name}
                    </span>
                    <span className="text-xs text-ghost flex-shrink-0">
                      {TYPE_LABELS[inquiry.inquiryType] || inquiry.inquiryType}
                    </span>
                    {inquiry.isReplied && (
                      <span className="text-xs text-ghost flex-shrink-0">返信済</span>
                    )}
                  </div>
                  <p className="text-xs text-ghost mt-0.5 truncate">
                    {inquiry.message.substring(0, 80)}
                    {inquiry.message.length > 80 ? '...' : ''}
                  </p>
                </div>
                <span className="text-xs text-ghost flex-shrink-0">
                  {new Date(inquiry.createdAt).toLocaleDateString('ja-JP')}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
