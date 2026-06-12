/**
 * 空白地帯 - トップページ
 *
 * このページは「空白」そのものを体験させる場所。
 * コンテンツは最小限に、余白を最大限に。
 *
 * 構成:
 * - 画面の80%以上は空白
 * - 中央に最新のお知らせ（最大5件）
 * - カウントダウンは右下隅に微かに存在
 * - サイト名は左上隅に消えかけた状態で表示
 * - 天候演出が背景でゆっくりと展開（Open-Meteo API連携）
 */

import { Suspense } from 'react';
import { CountdownServer } from '@/components/countdown';
import { WeatherAtmosphereClient } from '@/components/weather';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { DesktopNav } from '@/components/ui/DesktopNav';
import { NewsSection } from '@/components/news';
import { SocialLinks } from '@/components/social';
import { fetchPostsByCategory, fetchAllSocialLinks, fetchPublishedPages, fetchVersionGraph } from '@/lib/actions';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  // 並行取得でTTFBを最小化
  const [allNews, socialLinks, pages, graph] = await Promise.all([
    fetchPostsByCategory('news'),
    fetchAllSocialLinks(),
    fetchPublishedPages(),
    fetchVersionGraph(),
  ]);

  const latestNews = allNews.filter((post) => post.isPublished).slice(0, 5);

  // 最新バージョン（変更履歴）最大5件（createdAt降順）
  const latestVersions = [...graph.versions]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

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
        ソーシャルリンク - 右上隅に配置（PC only）
        控えめなアイコンで外部リンクを提供
      */}
      <div className="hug-corner-tr z-10 hidden md:block fade-in-slow">
        <SocialLinks links={socialLinks} size="small" />
      </div>

      {/*
        中央エリア - お知らせを表示
        お知らせがない場合は「空白」を維持
      */}
      <div className="flex-1 flex items-center justify-center z-10">
        <div className="w-full max-w-sm px-4 space-y-8">
          <NewsSection news={latestNews} />

          {latestVersions.length > 0 && (
            <div>
              <h2 className="text-[10px] text-ghost tracking-[0.3em] mb-4 text-center opacity-60">
                変容の履歴
              </h2>
              <ul className="space-y-3">
                {latestVersions.map((v, index) => (
                  <li
                    key={v.id}
                    className="fade-in-slow"
                    style={{ animationDelay: `${0.3 + index * 0.15}s` }}
                  >
                    <a href={`/history#${v.id}`} className="group block">
                      <time className="text-[9px] text-ghost opacity-50 tracking-wider">
                        {new Date(v.createdAt).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </time>
                      <p className="text-xs text-ghost leading-relaxed mt-0.5 group-hover:text-ink transition-colors duration-[var(--duration-subtle)]">
                        {v.title}
                      </p>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
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
        モバイルではメニュー内に移動するため非表示。
      */}
      <DesktopNav variant="corner" pages={pages} />

      {/* モバイルメニュー（ソーシャルリンク付き） */}
      <MobileMenu socialLinks={socialLinks} pages={pages} />
    </div>
  );
}
