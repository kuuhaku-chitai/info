'use client';

/**
 * 空白地帯 - 入金フォーム
 *
 * 入金を記録するフォーム。
 * 金額を入力すると、自動的に延命日数が計算される。
 */

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { recordNewDonation } from '@/lib/actions';
import { amountToSeconds, MONTHLY_COST, SECONDS_PER_MONTH } from '@/lib/constants';

export function DonationForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');

  // 延命日数を計算（リアルタイムプレビュー）
  const preview = useMemo(() => {
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      return null;
    }

    const addedSeconds = amountToSeconds(numAmount);
    const addedDays = Math.floor(addedSeconds / (24 * 60 * 60));
    const addedMonths = (numAmount / MONTHLY_COST).toFixed(2);

    return {
      addedDays,
      addedMonths,
      addedSeconds,
    };
  }, [amount]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('有効な金額を入力してください');
      return;
    }

    startTransition(async () => {
      try {
        await recordNewDonation({
          amount: numAmount,
          date: new Date(date).toISOString(),
          note: note.trim() || undefined,
        });

        router.push('/donations');
      } catch (err) {
        setError('記録に失敗しました');
        console.error(err);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      {/* エラー表示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* 金額 */}
      <div>
        <label htmlFor="amount" className="block text-xs text-ghost mb-2">
          金額（円） *
        </label>
        <input
          id="amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="1"
          step="1"
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="80000"
        />
      </div>

      {/* プレビュー */}
      {preview && (
        <div className="p-4 bg-edge/30 rounded">
          <p className="text-xs text-ghost mb-2">延命プレビュー</p>
          <p className="text-lg font-light text-ink">
            +{preview.addedDays.toLocaleString()}日
          </p>
          <p className="text-xs text-ghost mt-1">
            ≈ {preview.addedMonths}ヶ月
          </p>
        </div>
      )}

      {/* 日付 */}
      <div>
        <label htmlFor="date" className="block text-xs text-ghost mb-2">
          入金日
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
        />
      </div>

      {/* メモ */}
      <div>
        <label htmlFor="note" className="block text-xs text-ghost mb-2">
          メモ（任意）
        </label>
        <input
          id="note"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="入金元など"
        />
      </div>

      {/* 送信ボタン */}
      <div className="flex items-center gap-4 pt-4 border-t border-edge">
        <button
          type="submit"
          disabled={isPending || !preview}
          className="px-6 py-2 bg-ink text-void text-sm rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? '記録中...' : '記録する'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-4 py-2 border border-edge text-ghost text-sm rounded hover:border-ghost transition-colors"
        >
          キャンセル
        </button>
      </div>

      {/* 計算式の説明 */}
      <div className="text-xs text-ghost pt-4">
        <p>計算式: 金額 / ¥{MONTHLY_COST.toLocaleString()} × {Math.floor(SECONDS_PER_MONTH / (24 * 60 * 60))}日</p>
      </div>
    </form>
  );
}
