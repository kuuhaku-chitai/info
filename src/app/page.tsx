/**
 * 空白地帯 - トップページ
 *
 * このページは「空白」そのものを体験させる場所。
 * コンテンツは最小限に、余白を最大限に。
 *
 * 構成:
 * - 画面の80%以上は空白
 * - カウントダウンは右下隅に微かに存在
 * - サイト名は左上隅に消えかけた状態で表示
 * - 天候演出が背景でゆっくりと展開（Open-Meteo API連携）
 */

import { Suspense } from 'react';
import { CountdownServer } from '@/components/countdown';
import { WeatherAtmosphereClient } from '@/components/weather';

export default function HomePage() {
  return (
    <div className="void-embrace relative">
      {/*
        天候演出 - 背景レイヤー
        自然現象をCSSアニメーションで表現。
        中央のセーフゾーンを避け、画面端で静かに展開。
      */}
      <WeatherAtmosphereClient />

      {/*
        サイト名 - 左上隅に配置
        消えかけた状態で表示し、「未完」を示唆
      */}
      <header className="hug-corner-tl z-10">
        <h1 className="text-ghost text-xs tracking-[0.5em] font-light fade-in-slow">
          空白地帯
        </h1>
      </header>

      {/*
        中央エリア - 意図的に空にする
        この「何もない」空間が主役
      */}
      <div className="flex-1 flex items-center justify-center z-10">
        {/*
          ここには何も置かない。
          「空白」は情報の不在によって意味を持つ。
        */}
      </div>

      {/*
        カウントダウン - 右下隅に配置
        このサイトの「寿命」を静かに刻む
      */}
      <div className="hug-corner-br z-10">
        <Suspense fallback={<span className="text-ghost text-xs opacity-30">...</span>}>
          <CountdownServer size="whisper" />
        </Suspense>
      </div>

      {/*
        ナビゲーション - 左下隅に配置
        最小限のリンクのみ。押し付けがましくない。
      */}
      <nav className="hug-corner-bl z-10">
        <ul className="flex gap-4 text-xs text-ghost">
          <li>
            <a
              href="/blog"
              className="hover:text-ink transition-colors duration-[var(--duration-subtle)]"
            >
              記録
            </a>
          </li>
          <li>
            <a
              href="/schedule"
              className="hover:text-ink transition-colors duration-[var(--duration-subtle)]"
            >
              予定
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
