/**
 * 空白地帯 - プロジェクト編集ページ
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProjectById } from '@/lib/actions';
import { ProjectForm } from '../ProjectForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const project = await fetchProjectById(id);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">プロジェクトを編集</h1>
          <p className="text-xs text-ghost mt-1">
            {project.title}
          </p>
        </div>
        <Link
          href="/projects"
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          ← 一覧に戻る
        </Link>
      </div>

      {/* フォーム */}
      <ProjectForm project={project} />
    </div>
  );
}
