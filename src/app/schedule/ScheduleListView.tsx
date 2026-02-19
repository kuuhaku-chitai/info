'use client';

/**
 * 空白地帯 - スケジュールリストビュー
 *
 * イベントをシンプルなリスト形式で表示。
 * 「空白地帯」のコンセプトを維持した控えめなデザイン。
 */

import Link from 'next/link';
import type { Post } from '@/types';

interface ScheduleListViewProps {
  events: Post[];
}

export function ScheduleListView({ events }: ScheduleListViewProps) {
  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="text-ghost text-xs opacity-50 fade-in-slow">
          予定されているイベントはない。
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {events.map((event, index) => (
        <article
          key={event.id}
          className="fade-in-slow content-frame p-6"
          style={{ animationDelay: `${0.3 + index * 0.2}s` }}
        >
          {/* イベント日時 */}
          {event.eventStartDate && (
            <time className="block text-[10px] text-ghost mb-2 tracking-wider">
              {new Date(event.eventStartDate).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
              {event.eventEndDate && event.eventEndDate !== event.eventStartDate && (
                <>
                  {' '}〜{' '}
                  {new Date(event.eventEndDate).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </>
              )}
            </time>
          )}

          {/* タイトル */}
          <h2 className="text-sm font-light text-ink tracking-wide">
            <Link
              href={`/post/${event.id}`}
              className="hover:opacity-60 transition-opacity"
            >
              {event.title}
            </Link>
          </h2>

          {/* 抜粋（最初の100文字） */}
          {event.markdown && (
            <p className="text-xs text-ghost mt-3 line-clamp-2 leading-relaxed">
              {event.markdown.slice(0, 100)}
              {event.markdown.length > 100 && '...'}
            </p>
          )}

          {/* タグ */}
          {event.tags.length > 0 && (
            <div className="flex gap-2 mt-3">
              {event.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[10px] text-ghost opacity-50">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
