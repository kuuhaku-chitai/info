/**
 * 空白地帯 - プロジェクト詳細ページ
 *
 * プロジェクトの詳細を表示。
 * 下部に紐づく関連記事をカード一覧で表示する。
 * 「空白」のコンセプトを維持しながら、関連情報を控えめに提示。
 */

import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  fetchProjectById,
  fetchPostsByProjectId,
  fetchAllSocialLinks,
  fetchPublishedPages,
} from '@/lib/actions';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { DesktopNav } from '@/components/ui/DesktopNav';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getOptimizedImageUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const project = await fetchProjectById(id);

  if (!project) {
    return { title: '見つかりません' };
  }

  return {
    title: project.title,
    description: project.markdown.slice(0, 160),
  };
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const [project, relatedPosts, socialLinks, pages] = await Promise.all([
    fetchProjectById(id),
    fetchPostsByProjectId(id),
    fetchAllSocialLinks(),
    fetchPublishedPages(),
  ]);

  if (!project || !project.isPublished) {
    notFound();
  }

  // カテゴリラベル
  const categoryLabels: Record<string, string> = {
    article: '記事',
    note: 'メモ',
    event: 'イベント',
    news: 'お知らせ',
  };

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
        {project.thumbnailUrl && (
          <div className="relative aspect-video mb-12 content-frame overflow-hidden">
            <Image
              src={getOptimizedImageUrl(project.thumbnailUrl)}
              alt={project.title}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* メタ情報 */}
        <div className="flex items-center gap-3 mb-6 text-[10px] text-ghost">
          <span className="tracking-wider">プロジェクト</span>
          <span className="opacity-30">|</span>
          <time className="tracking-wider">
            {new Date(project.date).toLocaleDateString('ja-JP', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </time>
        </div>

        {/* タイトル */}
        <h1 className="text-xl font-light text-ink tracking-wide mb-12 leading-relaxed">
          {project.title}
        </h1>

        {/* 本文 */}
        <MarkdownRenderer content={project.markdown} />

        {/* タグ */}
        {project.tags.length > 0 && (
          <div className="flex gap-3 mt-16 pt-8 border-t border-edge">
            {project.tags.map((tag) => (
              <span key={tag} className="text-xs text-ghost">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </article>

      {/* 関連記事 - プロジェクトに紐づく投稿をカード一覧で表示 */}
      {relatedPosts.length > 0 && (
        <section className="max-w-2xl mx-auto mt-20 fade-in-slow">
          <h2 className="text-xs text-ghost tracking-[0.3em] mb-8">
            関連記事
          </h2>
          <div className="space-y-4">
            {relatedPosts.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className="block group content-frame p-4 hover:border-ghost transition-colors duration-500"
              >
                <div className="flex gap-4">
                  {/* サムネイル（ある場合） */}
                  {post.thumbnailUrl && (
                    <div className="relative w-20 h-14 flex-shrink-0 overflow-hidden rounded">
                      <Image
                        src={getOptimizedImageUrl(post.thumbnailUrl)}
                        alt={post.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {/* メタ情報 */}
                    <div className="flex items-center gap-2 mb-1 text-[10px] text-ghost">
                      <span>{categoryLabels[post.category]}</span>
                      <span className="opacity-30">|</span>
                      <time>
                        {new Date(post.date).toLocaleDateString('ja-JP')}
                      </time>
                    </div>
                    {/* タイトル */}
                    <h3 className="text-sm font-light text-ink truncate group-hover:opacity-70 transition-opacity duration-500">
                      {post.title}
                    </h3>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 戻るリンク */}
      <nav className="max-w-2xl mx-auto mt-16 pt-8 border-t border-edge hidden md:block">
        <Link
          href="/projects"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← プロジェクトに戻る
        </Link>
      </nav>

      {/* デスクトップナビゲーション */}
      <DesktopNav variant="footer" pages={pages} />

      <MobileMenu socialLinks={socialLinks} pages={pages} />
    </div>
  );
}
