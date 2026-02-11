/**
 * 空白地帯 - 入金記録ページ
 *
 * 新しい入金を記録するフォーム。
 * 入金を記録すると自動的に延命処理が行われる。
 */

import Link from 'next/link';
import { DonationForm } from '../DonationForm';

export default function NewDonationPage() {
  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">入金を記録</h1>
          <p className="text-xs text-ghost mt-1">
            命を延ばす
          </p>
        </div>
        <Link
          href="/donations"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </Link>
      </div>

      {/* フォーム */}
      <DonationForm />
    </div>
  );
}
