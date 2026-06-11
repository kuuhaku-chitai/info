/**
 * 空白地帯 - バージョン（変更履歴）の編集
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchAllBranches, fetchVersionDetail, fetchVersionGraph } from '@/lib/actions';
import { VersionForm } from '../VersionForm';

export const dynamic = 'force-dynamic';

interface EditVersionPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditVersionPage({ params }: EditVersionPageProps) {
  const { id } = await params;
  const [version, branches, graph] = await Promise.all([
    fetchVersionDetail(id),
    fetchAllBranches(),
    fetchVersionGraph(),
  ]);

  if (!version) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">変更を編集</h1>
          <p className="text-xs text-ghost mt-1">{version.title}</p>
        </div>
        <Link href="/space" className="text-xs text-ghost hover:text-ink transition-colors">
          ← 一覧に戻る
        </Link>
      </div>

      <VersionForm version={version} branches={branches} allVersions={graph.versions} />
    </div>
  );
}
