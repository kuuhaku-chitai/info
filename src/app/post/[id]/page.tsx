/**
 * 空白地帯 - 投稿詳細ページ
 *
 * 個別の投稿を表示。
 * Markdownをレンダリングし、「空白」のコンセプトを維持。
 */

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { fetchPostById, fetchAllSocialLinks, fetchPublishedPages } from '@/lib/actions';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getOptimizedImageUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const post = await fetchPostById(id);

  if (!post) {
    return { title: '見つかりません' };
  }

  return {
    title: post.title,
    description: post.markdown.slice(0, 160),
  };
}

export default async function PostPage({ params }: PageProps) {
  const { id } = await params;
  const [post, socialLinks, pages] = await Promise.all([
    fetchPostById(id),
    fetchAllSocialLinks(),
    fetchPublishedPages(),
  ]);

  if (!post || !post.isPublished) {
    notFound();
  }

  // カテゴリラベル
  const categoryLabels = {
    article: '記事',
    note: 'メモ',
    event: 'イベント',
    news: 'お知らせ',
  };

  // 戻り先を決定（プロジェクト紐づきの場合はプロジェクト詳細へ）
  const getBackLink = () => {
    if (post.projectId) return { link: `/project/${post.projectId}`, label: 'プロジェクト' };
    if (post.category === 'event') return { link: '/schedule', label: '予定' };
    if (post.category === 'news') return { link: '/', label: 'トップ' };
    return { link: '/blog', label: '記録' };
  };
  const { link: backLink, label: backLabel } = getBackLink();

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
        {post.thumbnailUrl && (
          <div className="relative aspect-video mb-12 content-frame overflow-hidden">
            <Image
              src={getOptimizedImageUrl(post.thumbnailUrl)}
              alt={post.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* メタ情報 */}
        <div className="flex items-center gap-3 mb-6 text-[10px] text-ghost">
          <span className="tracking-wider">
            {categoryLabels[post.category]}
          </span>
          <span className="opacity-30">|</span>
          <time className="tracking-wider">
            {new Date(post.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
          {post.category === 'event' && post.eventStartDate && (
            <>
              <span className="opacity-30">|</span>
              <span className="tracking-wider">
                開催: {new Date(post.eventStartDate).toLocaleDateString('ja-JP')}
              </span>
            </>
          )}
        </div>

        {/* タイトル */}
        <h1 className="text-xl font-light text-ink tracking-wide mb-12 leading-relaxed">
          {post.title}
        </h1>

        {/* 本文 */}
        <MarkdownRenderer content={post.markdown} />

        {/* タグ */}
        {post.tags.length > 0 && (
          <div className="flex gap-3 mt-16 pt-8 border-t border-edge">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs text-ghost">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* フッターナビ */}
      <nav className="max-w-2xl mx-auto mt-16 pt-8 border-t border-edge hidden md:block">
        <Link
          href={backLink}
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← {backLabel}に戻る
        </Link>
      </nav>

      <MobileMenu socialLinks={socialLinks} pages={pages} />
    </div>
  );
}
