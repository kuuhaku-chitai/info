'use client';

/**
 * 空白地帯 - スケジュールコンテンツ
 *
 * リストモードとカレンダーモードの切り替えを提供。
 * BlogContent.tsxと同様の構造で統一感を持たせる。
 */

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { Post } from '@/types';
import { ScheduleListView } from './ScheduleListView';
import { ScheduleCalendarView } from './ScheduleCalendarView';
import { MobileMenu } from '@/components/ui/MobileMenu';

type ViewMode = 'list' | 'calendar';

interface ScheduleContentProps {
  events: Post[];
}

export function ScheduleContent({ events }: ScheduleContentProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const toggleMode = useCallback(() => {
    setViewMode((prev) => (prev === 'list' ? 'calendar' : 'list'));
  }, []);

  return (
    <div className="void-embrace relative">
      {/* ヘッダー */}
      <header className="hug-corner-tl z-10">
        <Link
          href="/"
          className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          空白地帯
        </Link>
      </header>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-start px-4 md:px-8 pt-24 pb-24">
        <h1 className="text-ghost text-sm tracking-[0.3em] font-light mb-8 fade-in-slow">
          予定
        </h1>

        {/* ビュー */}
        <div className="w-full max-w-4xl fade-in-slow" style={{ animationDelay: '0.2s' }}>
          {viewMode === 'list' ? (
            <ScheduleListView events={events} />
          ) : (
            <ScheduleCalendarView events={events} />
          )}
        </div>
      </div>

      {/* 戻るリンク - モバイルでは非表示 */}
      <nav className="hug-corner-bl z-10 hidden md:block">
        <Link
          href="/"
          className="text-xs text-ghost hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          ← 戻る
        </Link>
      </nav>

      {/* モード切り替えボタン */}
      <button
        onClick={toggleMode}
        className="fixed bottom-[var(--space-lg)] right-[var(--space-lg)] z-30 group"
        aria-label={viewMode === 'list' ? 'カレンダーモードに切り替え' : 'リストモードに切り替え'}
      >
        <div
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-void)] border border-[var(--color-edge)] transition-all duration-[var(--duration-subtle)] group-hover:border-[var(--color-ghost)]"
          style={{
            clipPath: 'polygon(2% 0%, 100% 1%, 98% 100%, 0% 99%)',
          }}
        >
          {/* アイコン */}
          <span className="text-ghost text-xs opacity-60 group-hover:opacity-100 transition-opacity">
            {viewMode === 'list' ? '▦' : '≡'}
          </span>
          {/* ラベル */}
          <span className="text-[10px] text-ghost tracking-wider group-hover:text-ink transition-colors">
            {viewMode === 'list' ? 'CALENDAR' : 'LIST'}
          </span>
        </div>
      </button>

      <MobileMenu />
    </div>
  );
}
