/**
 * 空白地帯 - 入金一覧ページ（管理画面）
 *
 * 入金（延命）の履歴を表示。
 * 各入金がどれだけの「命」を追加したかを可視化。
 */

import Link from 'next/link';
import { fetchAllDonations } from '@/lib/actions';
import { MONTHLY_COST } from '@/lib/constants';
import { DeleteDonationButton } from './DeleteDonationButton';

export const dynamic = 'force-dynamic';

export default async function DonationsPage() {
  const donations = await fetchAllDonations();

  // 累計を計算
  const totalAmount = donations.reduce((sum, d) => sum + d.amount, 0);
  const totalSeconds = donations.reduce((sum, d) => sum + d.addedSeconds, 0);
  const totalDays = Math.floor(totalSeconds / (24 * 60 * 60));

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">入金記録</h1>
          <p className="text-xs text-ghost mt-1">
            延命の履歴
          </p>
        </div>
        <Link
          href="/donations/new"
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
        >
          入金を記録
        </Link>
      </div>

      {/* 統計 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="content-frame p-4">
          <p className="text-xs text-ghost mb-1">入金件数</p>
          <p className="text-xl font-light text-ink">{donations.length}件</p>
        </div>
        <div className="content-frame p-4">
          <p className="text-xs text-ghost mb-1">累計金額</p>
          <p className="text-xl font-light text-ink">¥{totalAmount.toLocaleString()}</p>
        </div>
        <div className="content-frame p-4">
          <p className="text-xs text-ghost mb-1">延命日数</p>
          <p className="text-xl font-light text-ink">+{totalDays.toLocaleString()}日</p>
        </div>
      </div>

      {/* 入金一覧 */}
      {donations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ghost text-sm">まだ入金がありません</p>
          <Link
            href="/donations/new"
            className="inline-block mt-4 text-xs text-ink underline hover:no-underline"
          >
            最初の入金を記録
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {donations.map((donation) => {
            const addedDays = Math.floor(donation.addedSeconds / (24 * 60 * 60));
            const addedMonths = (donation.amount / MONTHLY_COST).toFixed(2);

            return (
              <div
                key={donation.id}
                className="content-frame p-4 flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    {/* 金額 */}
                    <span className="text-sm font-medium text-ink">
                      ¥{donation.amount.toLocaleString()}
                    </span>
                    {/* 延命日数 */}
                    <span className="text-xs text-ghost">
                      +{addedDays}日（{addedMonths}ヶ月）
                    </span>
                  </div>
                  {/* メモ */}
                  {donation.note && (
                    <p className="text-xs text-ghost mt-1 truncate">
                      {donation.note}
                    </p>
                  )}
                  {/* 日付 */}
                  <p className="text-xs text-ghost mt-1">
                    {new Date(donation.date).toLocaleDateString('ja-JP')}
                  </p>
                </div>

                {/* アクション */}
                <DeleteDonationButton id={donation.id} amount={donation.amount} />
              </div>
            );
          })}
        </div>
      )}

      {/* 計算式の説明 */}
      <div className="text-xs text-ghost space-y-1 pt-8 border-t border-edge">
        <p>延命計算式:</p>
        <p className="font-mono">
          入金額 / ¥{MONTHLY_COST.toLocaleString()} × 30.44日 = 延命日数
        </p>
      </div>
    </div>
  );
}
