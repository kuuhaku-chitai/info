/**
 * 空白地帯 - スケジュール（予定）ページ
 *
 * イベント（展示、パフォーマンス等）のカレンダー表示。
 * カレンダーは「グリッドの崩壊」を体現する台形マスク内に配置。
 *
 * Phase 1: スタブページ
 * Phase 2: Workers KVからイベントを取得してカレンダー表示
 */

import Link from 'next/link';

export const metadata = {
  title: '予定',
  description: 'イベント、展示、パフォーマンスの予定。',
};

export default function SchedulePage() {
  return (
    <div className="void-embrace relative">
      {/* ヘッダー */}
      <header className="hug-corner-tl">
        <Link
          href="/"
          className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          空白地帯
        </Link>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-ghost text-sm tracking-[0.3em] font-light mb-8 fade-in-slow">
            予定
          </h1>
          <p className="text-ghost text-xs opacity-50 fade-in-slow" style={{ animationDelay: '0.5s' }}>
            予定されているイベントはない。
          </p>
        </div>
      </div>

      {/* 戻るリンク */}
      <nav className="hug-corner-bl">
        <Link
          href="/"
          className="text-xs text-ghost hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          ← 戻る
        </Link>
      </nav>
    </div>
  );
}
