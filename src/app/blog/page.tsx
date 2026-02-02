/**
 * 空白地帯 - ブログ（記録）ページ
 *
 * 断片的な思考、エッセイ、メモが蓄積される場所。
 * 投稿は時系列ではなく、「密度」の低い順に並ぶ。
 * 古いものほど「消えかけ」の状態で表示される。
 *
 * Phase 1: スタブページ
 * Phase 2: Workers KVから投稿を取得して表示
 */

import Link from 'next/link';

export const metadata = {
  title: '記録',
  description: '断片的な思考、エッセイ、メモの蓄積。',
};

export default function BlogPage() {
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
            記録
          </h1>
          <p className="text-ghost text-xs opacity-50 fade-in-slow" style={{ animationDelay: '0.5s' }}>
            まだ何も書かれていない。
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
