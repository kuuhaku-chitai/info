/**
 * 空白地帯 - ブログ（記録）ページ
 *
 * 記事とメモを表示。
 * 「空白」のコンセプトを維持しながら、
 * 断片的な思考を控えめに提示する。
 */

import Link from 'next/link';
import { fetchPublishedPosts } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '記録',
  description: '断片的な思考、エッセイ、メモの蓄積。',
};

export default async function BlogPage() {
  const allPosts = await fetchPublishedPosts();
  // イベント以外の投稿（記事とメモ）を表示
  const posts = allPosts.filter((post) => post.category !== 'event');

  // カテゴリラベル
  const categoryLabels = {
    article: '記事',
    note: 'メモ',
    event: 'イベント',
  };

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
          記録
        </h1>

        {posts.length === 0 ? (
          <p
            className="text-ghost text-xs opacity-50 fade-in-slow"
            style={{ animationDelay: '0.5s' }}
          >
            まだ何も書かれていない。
          </p>
        ) : (
          <div className="w-full max-w-md space-y-6">
            {posts.map((post, index) => (
              <article
                key={post.id}
                className="fade-in-slow"
                style={{ animationDelay: `${0.3 + index * 0.15}s` }}
              >
                <Link
                  href={`/post/${post.id}`}
                  className="block group"
                >
                  {/* 日付とカテゴリ */}
                  <div className="flex items-center gap-2 mb-1">
                    <time className="text-[10px] text-ghost tracking-wider">
                      {new Date(post.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                    <span className="text-[10px] text-ghost opacity-50">
                      {categoryLabels[post.category]}
                    </span>
                  </div>

                  {/* タイトル */}
                  <h2 className="text-sm font-light text-ink tracking-wide group-hover:opacity-60 transition-opacity">
                    {post.title}
                  </h2>

                  {/* 抜粋 */}
                  {post.markdown && (
                    <p className="text-xs text-ghost mt-2 line-clamp-2 leading-relaxed">
                      {post.markdown.slice(0, 80)}
                      {post.markdown.length > 80 && '...'}
                    </p>
                  )}
                </Link>

                {/* 区切り線（最後の要素以外） */}
                {index < posts.length - 1 && (
                  <div className="border-b border-edge mt-6 opacity-30" />
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
