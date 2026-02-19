/**
 * 空白地帯 - 固定ページ表示
 *
 * 動的ルートで固定ページを表示。
 * /concept, /about などのパスに対応。
 * 既存ルート（/blog, /schedule等）はNext.jsが優先的に解決するため競合しない。
 */

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { fetchPageByPath, fetchAllSocialLinks, fetchPublishedPages } from '@/lib/actions';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { DesktopNav } from '@/components/ui/DesktopNav';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getOptimizedImageUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ path: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { path } = await params;
  const page = await fetchPageByPath(path);

  if (!page) {
    return { title: '見つかりません' };
  }

  return {
    title: page.title,
    description: page.markdown.slice(0, 160),
  };
}

export default async function StaticPage({ params }: PageProps) {
  const { path } = await params;
  const [page, socialLinks, pages] = await Promise.all([
    fetchPageByPath(path),
    fetchAllSocialLinks(),
    fetchPublishedPages(),
  ]);

  if (!page) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-[var(--color-void)] pt-16 pb-32 px-8">
      {/* ヘッダー */}
      <header className="max-w-2xl mx-auto mb-16">
        <Link
          href="/"
          className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors duration-[var(--duration-subtle)]"
        >
          空白地帯
        </Link>
      </header>

      {/* メインコンテンツ */}
      <article className="max-w-2xl mx-auto fade-in-slow">
        {/* アイキャッチ画像 */}
        {page.thumbnailUrl && (
          <div className="relative aspect-video mb-12 content-frame overflow-hidden">
            <Image
              src={getOptimizedImageUrl(page.thumbnailUrl)}
              alt={page.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* タイトル */}
        <h1 className="text-xl font-light text-ink tracking-wide mb-12 leading-relaxed">
          {page.title}
        </h1>

        {/* 本文 */}
        <MarkdownRenderer content={page.markdown} />
      </article>

      {/* デスクトップナビゲーション */}
      <DesktopNav variant="footer" pages={pages} />

      <MobileMenu socialLinks={socialLinks} pages={pages} />
    </div>
  );
}
