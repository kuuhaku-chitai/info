/**
 * 空白地帯 - プロジェクト一覧ページ
 *
 * 公開プロジェクトをシンプルなリストで表示。
 * 「空白」のコンセプトを維持しながら、プロジェクト情報を控えめに提示する。
 */

import Link from 'next/link';
import Image from 'next/image';
import { fetchPublishedProjects, fetchAllSocialLinks } from '@/lib/actions';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { getOptimizedImageUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'プロジェクト',
  description: 'プロジェクトの一覧。',
};

export default async function ProjectsPage() {
  const [projects, socialLinks] = await Promise.all([
    fetchPublishedProjects(),
    fetchAllSocialLinks(),
  ]);

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

      {/* タイトル */}
      <div className="max-w-2xl mx-auto mb-12 fade-in-slow">
        <h1 className="text-lg font-light text-ink tracking-wide">
          プロジェクト
        </h1>
      </div>

      {/* プロジェクト一覧 */}
      <div className="max-w-2xl mx-auto fade-in-slow">
        {projects.length === 0 ? (
          <p className="text-ghost text-xs text-center py-16">
            プロジェクトはまだありません
          </p>
        ) : (
          <div className="space-y-8">
            {projects.map((project) => (
              <Link
                key={project.id}
                href={`/project/${project.id}`}
                className="block group"
              >
                <article className="space-y-3">
                  {/* サムネイル */}
                  {project.thumbnailUrl && (
                    <div className="relative aspect-video content-frame overflow-hidden">
                      <Image
                        src={getOptimizedImageUrl(project.thumbnailUrl)}
                        alt={project.title}
                        fill
                        className="object-cover group-hover:opacity-80 transition-opacity duration-500"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* メタ情報 */}
                  <div className="flex items-center gap-3 text-[10px] text-ghost">
                    <time className="tracking-wider">
                      {new Date(project.date).toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                    {project.tags.length > 0 && (
                      <>
                        <span className="opacity-30">|</span>
                        <span className="tracking-wider">
                          {project.tags.map((tag) => `#${tag}`).join(' ')}
                        </span>
                      </>
                    )}
                  </div>

                  {/* タイトル */}
                  <h2 className="text-sm font-light text-ink tracking-wide group-hover:opacity-70 transition-opacity duration-500">
                    {project.title}
                  </h2>

                  {/* 概要（最初の100文字） */}
                  {project.markdown && (
                    <p className="text-xs text-ghost leading-relaxed line-clamp-2">
                      {project.markdown.replace(/[#*_`\[\]()]/g, '').slice(0, 100)}
                    </p>
                  )}
                </article>

                {/* 区切り線 */}
                <div className="mt-8 border-b border-edge" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* フッターナビ */}
      <nav className="max-w-2xl mx-auto mt-16 pt-8 border-t border-edge hidden md:block">
        <Link
          href="/"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← トップに戻る
        </Link>
      </nav>

      <MobileMenu socialLinks={socialLinks} />
    </div>
  );
}
