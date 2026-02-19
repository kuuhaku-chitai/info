'use client';

/**
 * 空白地帯 - カウントダウン設定フォーム
 *
 * 開始日・初期資金・月額コストを編集可能に。
 * 保存時に initialTotalSeconds を自動再計算。
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateCountdownSettingsAction } from '@/lib/actions';
import { SECONDS_PER_MONTH } from '@/lib/constants';
import type { CountdownState } from '@/types';

interface CountdownSettingsFormProps {
  countdown: CountdownState;
}

export function CountdownSettingsForm({ countdown }: CountdownSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 開始日を YYYY-MM-DD 形式に変換
  const initialDate = countdown.startDate.split('T')[0];

  const [startDate, setStartDate] = useState(initialDate);
  const [monthlyCost, setMonthlyCost] = useState(countdown.monthlyCost);
  const [initialFund, setInitialFund] = useState(countdown.initialFund);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // プレビュー計算
  const previewSeconds = Math.floor((initialFund / monthlyCost) * SECONDS_PER_MONTH);
  const previewDays = Math.floor(previewSeconds / (24 * 60 * 60));
  const previewMonths = (previewSeconds / SECONDS_PER_MONTH).toFixed(1);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (monthlyCost <= 0 || initialFund <= 0) {
      setError('金額は0より大きい値を入力してください');
      return;
    }

    startTransition(async () => {
      try {
        // 開始日を ISO 8601 形式に変換（時刻は元の値から維持、または00:00:00を使用）
        const startDateISO = `${startDate}T00:00:00.000Z`;

        await updateCountdownSettingsAction({
          startDate: startDateISO,
          monthlyCost,
          initialFund,
        });

        setSuccess(true);
        router.refresh();
      } catch {
        setError('更新に失敗しました');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 開始日 */}
        <div className="space-y-2">
          <label className="block text-xs text-ghost">開始日</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
          />
        </div>

        {/* 初期資金 */}
        <div className="space-y-2">
          <label className="block text-xs text-ghost">初期資金（円）</label>
          <input
            type="number"
            value={initialFund}
            onChange={(e) => setInitialFund(Number(e.target.value))}
            required
            min={1}
            className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
          />
        </div>

        {/* 月額コスト */}
        <div className="space-y-2">
          <label className="block text-xs text-ghost">月額コスト（円）</label>
          <input
            type="number"
            value={monthlyCost}
            onChange={(e) => setMonthlyCost(Number(e.target.value))}
            required
            min={1}
            className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* 計算プレビュー */}
      <div className="text-xs text-ghost font-mono space-y-1 p-3 bg-edge/20 rounded">
        <p>
          初期寿命 = ¥{initialFund.toLocaleString()} / ¥{monthlyCost.toLocaleString()}/月 × {Math.floor(SECONDS_PER_MONTH / (24 * 60 * 60))}日/月 = {previewDays}日（≈ {previewMonths}ヶ月）
        </p>
        <p>
          延命計算 = 入金額 / ¥{monthlyCost.toLocaleString()} × {Math.floor(SECONDS_PER_MONTH / (24 * 60 * 60))}日
        </p>
      </div>

      {/* エラー・成功メッセージ */}
      {error && (
        <p className="text-xs text-[var(--color-critical)]">{error}</p>
      )}
      {success && (
        <p className="text-xs text-ghost">設定を更新しました</p>
      )}

      {/* 保存ボタン */}
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {isPending ? '保存中...' : '設定を保存'}
      </button>
    </form>
  );
}
