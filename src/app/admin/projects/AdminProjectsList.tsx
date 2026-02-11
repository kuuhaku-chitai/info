'use client';

/**
 * AdminProjectsList - 管理画面用 プロジェクト一覧（ページネーション・フィルター付き）
 *
 * AdminPostsList と同じパターンを踏襲。
 */

import { useState, useMemo } from 'react';
import Link from 'next/link';
import type { Project, PostCategory } from '@/types';
import { DeleteProjectButton } from './DeleteProjectButton';
import { Pagination } from '@/components/Pagination';

interface AdminProjectsListProps {
  projects: Project[];
}

type FilterCategory = 'all' | PostCategory;

const categoryLabels: Record<string, string> = {
  all: 'すべて',
  event: 'イベント',
  article: '記事',
  note: 'メモ',
  news: 'お知らせ',
};

const filterCategories: FilterCategory[] = ['all', 'note', 'article', 'event', 'news'];

export function AdminProjectsList({ projects }: AdminProjectsListProps) {
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');

  // フィルタリングされたプロジェクト
  const filteredProjects = useMemo(() => {
    if (selectedCategory === 'all') {
      return projects;
    }
    return projects.filter((project) => project.category === selectedCategory);
  }, [projects, selectedCategory]);

  // 各カテゴリのプロジェクト数をカウント
  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: projects.length,
      event: 0,
      article: 0,
      note: 0,
      news: 0,
    };
    projects.forEach((project) => {
      counts[project.category]++;
    });
    return counts;
  }, [projects]);

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-ghost text-sm">まだプロジェクトがありません</p>
        <Link
          href="/projects/new"
          className="inline-block mt-4 text-xs text-ink underline hover:no-underline"
        >
          最初のプロジェクトを作成
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* カテゴリフィルター */}
      <div className="flex flex-wrap gap-2">
        {filterCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 text-xs border rounded transition-all ${
              selectedCategory === cat
                ? 'bg-ink text-void border-ink'
                : 'bg-transparent text-ghost border-edge hover:border-ghost hover:text-ink'
            }`}
          >
            {categoryLabels[cat]}
            <span className="ml-1 opacity-60">({categoryCounts[cat]})</span>
          </button>
        ))}
      </div>

      {/* フィルター結果が0件の場合 */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-ghost text-sm">
            「{categoryLabels[selectedCategory]}」のプロジェクトはありません
          </p>
        </div>
      ) : (
        <Pagination
          items={filteredProjects}
          itemsPerPageOptions={[5, 10, 50, 100]}
          defaultItemsPerPage={10}
          variant="default"
        >
          {(currentProjects) => (
            <div className="space-y-2">
              {currentProjects.map((project) => (
                <div
                  key={project.id}
                  className="content-frame p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {/* カテゴリバッジ */}
                      <span className="text-[10px] px-2 py-0.5 bg-edge text-ghost rounded">
                        {categoryLabels[project.category]}
                      </span>
                      {/* 公開状態 */}
                      {project.isPublished ? (
                        <span className="text-[10px] text-ink">公開中</span>
                      ) : (
                        <span className="text-[10px] text-ghost">下書き</span>
                      )}
                    </div>
                    {/* タイトル */}
                    <h2 className="text-sm font-medium text-ink truncate">
                      {project.title}
                    </h2>
                    {/* 日付 */}
                    <p className="text-xs text-ghost mt-1">
                      {new Date(project.date).toLocaleDateString('ja-JP')}
                    </p>
                  </div>

                  {/* アクション */}
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/projects/${project.id}`}
                      className="px-3 py-1 text-xs border border-edge text-ink rounded hover:border-ghost transition-colors"
                    >
                      編集
                    </Link>
                    <DeleteProjectButton id={project.id} title={project.title} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Pagination>
      )}
    </div>
  );
}
