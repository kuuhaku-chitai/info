/**
 * 空白地帯 - お知らせセクション
 *
 * トップページ中央に表示する最新のお知らせ。
 * 「空白」のコンセプトを維持しながら、
 * 重要な告知を控えめに提示する。
 *
 * - 最新5件まで表示
 * - お知らせがない場合は何も表示しない（空白を維持）
 */

import Link from 'next/link';
import type { Post } from '@/types';

interface NewsSectionProps {
  news: Post[];
}

export function NewsSection({ news }: NewsSectionProps) {
  // お知らせがない場合は何も表示しない
  if (news.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-sm px-4">
      {/* セクションタイトル - 控えめに */}
      <h2 className="text-[10px] text-ghost tracking-[0.3em] mb-4 text-center opacity-60">
        お知らせ
      </h2>

      {/* お知らせリスト */}
      <ul className="space-y-3">
        {news.map((item, index) => (
          <li
            key={item.id}
            className="fade-in-slow"
            style={{ animationDelay: `${0.3 + index * 0.15}s` }}
          >
            <Link
              href={`/post/${item.id}`}
              className="group block"
            >
              {/* 日付 */}
              <time className="text-[9px] text-ghost opacity-50 tracking-wider">
                {new Date(item.date).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}
              </time>
              {/* タイトル */}
              <p className="text-xs text-ghost leading-relaxed mt-0.5 group-hover:text-ink transition-colors duration-[var(--duration-subtle)]">
                {item.title}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
