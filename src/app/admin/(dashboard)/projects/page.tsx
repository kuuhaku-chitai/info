
import Link from 'next/link';
import { fetchAllProjects } from '@/lib/actions';
import { AdminProjectsList } from './AdminProjectsList';

export const dynamic = 'force-dynamic';

export default async function ProjectsPage() {
  const projects = await fetchAllProjects();

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">プロジェクト一覧</h1>
          <p className="text-xs text-ghost mt-1">
            {projects.length}件のプロジェクト
          </p>
        </div>
        <Link
          href="/projects/new"
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
        >
          新規プロジェクト
        </Link>
      </div>

      {/* プロジェクト一覧（ページネーション付き） */}
      <AdminProjectsList projects={projects} />
    </div>
  );
}
