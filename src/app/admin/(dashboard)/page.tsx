/**
 * 空白地帯 - 管理ダッシュボード
 *
 * サイトの状態を一覧で確認できるページ。
 * - カウントダウン残り時間
 * - 最近の入金
 * - 投稿数
 * - 寿命計算設定（編集可能）
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { CountdownServer } from '@/components/countdown';
import { fetchStats, fetchCountdownState } from '@/lib/actions';
import { SECONDS_PER_MONTH } from '@/lib/constants';
import { calculateRemainingSeconds } from '@/lib/countdown';
import { CountdownSettingsForm } from './CountdownSettingsForm';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const [stats, countdown] = await Promise.all([
    fetchStats(),
    fetchCountdownState(),
  ]);

  // 残り時間を計算
  const remainingSeconds = calculateRemainingSeconds(countdown);
  const remainingMonths = (remainingSeconds / SECONDS_PER_MONTH).toFixed(1);

  // DB から初期寿命を取得（定数ではなくDBの値を使用）
  const initialLifespanDays = Math.floor(countdown.initialTotalSeconds / (24 * 60 * 60));

  return (
    <div className="space-y-8">
      {/* ページタイトル */}
      <div>
        <h1 className="text-lg font-medium text-ink tracking-wide">
          ダッシュボード
        </h1>
        <p className="text-xs text-ghost mt-1">
          空白地帯の状態
        </p>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 残り時間 */}
        <div className="content-frame p-6">
          <h2 className="text-xs text-ghost mb-2">残り時間</h2>
          <div className="text-2xl font-light text-ink">
            <Suspense fallback={<span className="opacity-30">...</span>}>
              <CountdownServer size="presence" />
            </Suspense>
          </div>
          <p className="text-xs text-ghost mt-2">
            ≈ {remainingMonths}ヶ月
          </p>
        </div>

        {/* 投稿数 */}
        <div className="content-frame p-6">
          <h2 className="text-xs text-ghost mb-2">投稿</h2>
          <div className="text-2xl font-light text-ink">
            {stats.publishedPosts}
            <span className="text-sm text-ghost ml-1">/ {stats.totalPosts}</span>
          </div>
          <p className="text-xs text-ghost mt-2">
            公開 / 全体
          </p>
        </div>

        {/* 入金累計 */}
        <div className="content-frame p-6">
          <h2 className="text-xs text-ghost mb-2">入金累計</h2>
          <div className="text-2xl font-light text-ink">
            ¥{stats.totalDonationAmount.toLocaleString()}
          </div>
          <p className="text-xs text-ghost mt-2">
            +{Math.floor(stats.addedSeconds / (24 * 60 * 60))}日 延命
          </p>
        </div>
      </div>

      {/* 詳細統計 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 border border-edge rounded">
          <p className="text-xs text-ghost">イベント予定</p>
          <p className="text-lg font-light text-ink mt-1">{stats.upcomingEvents}件</p>
        </div>
        <div className="p-4 border border-edge rounded">
          <p className="text-xs text-ghost">入金件数</p>
          <p className="text-lg font-light text-ink mt-1">{stats.totalDonations}件</p>
        </div>
        <div className="p-4 border border-edge rounded">
          <p className="text-xs text-ghost">開始日</p>
          <p className="text-lg font-light text-ink mt-1">
            {new Date(countdown.startDate).toLocaleDateString('ja-JP')}
          </p>
        </div>
        <div className="p-4 border border-edge rounded">
          <p className="text-xs text-ghost">初期寿命</p>
          <p className="text-lg font-light text-ink mt-1">
            {initialLifespanDays}日
          </p>
        </div>
      </div>

      {/* クイックアクション */}
      <div>
        <h2 className="text-sm font-medium text-ink mb-4">クイックアクション</h2>
        <div className="flex gap-4">
          <Link
            href="/posts/new"
            className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
          >
            新規投稿
          </Link>
          <Link
            href="/donations/new"
            className="px-4 py-2 border border-edge text-ink text-xs rounded hover:border-ghost transition-colors"
          >
            入金記録
          </Link>
        </div>
      </div>

      {/* 寿命計算設定 */}
      <div className="pt-8 border-t border-edge">
        <h2 className="text-sm font-medium text-ink mb-4">寿命計算設定</h2>
        <CountdownSettingsForm countdown={countdown} />
      </div>
    </div>
  );
}
