/**
 * 空白地帯 - スケジュール（予定）ページ
 *
 * イベント（展示、パフォーマンス等）を表示。
 * 「空白」のコンセプトを維持しながら、
 * イベント情報を控えめに提示する。
 */

import Link from 'next/link';
import { fetchPostsByCategory } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '予定',
  description: 'イベント、展示、パフォーマンスの予定。',
};

export default async function SchedulePage() {
  const events = await fetchPostsByCategory('event');

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
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <h1 className="text-ghost text-sm tracking-[0.3em] font-light mb-12 fade-in-slow">
          予定
        </h1>

        {events.length === 0 ? (
          <p
            className="text-ghost text-xs opacity-50 fade-in-slow"
            style={{ animationDelay: '0.5s' }}
          >
            予定されているイベントはない。
          </p>
        ) : (
          <div className="w-full max-w-md space-y-8">
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
                      <span
                        key={tag}
                        className="text-[10px] text-ghost opacity-50"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
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
