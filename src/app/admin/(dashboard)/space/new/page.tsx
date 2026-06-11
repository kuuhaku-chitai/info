/**
 * 空白地帯 - 新規バージョン（変更履歴）の記録
 */

import Link from 'next/link';
import { fetchAllBranches, fetchVersionGraph } from '@/lib/actions';
import { VersionForm } from '../VersionForm';

export const dynamic = 'force-dynamic';

interface NewVersionPageProps {
  searchParams: Promise<{ branch?: string }>;
}

export default async function NewVersionPage({ searchParams }: NewVersionPageProps) {
  const { branch } = await searchParams;
  const [branches, graph] = await Promise.all([fetchAllBranches(), fetchVersionGraph()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">変更を記録</h1>
          <p className="text-xs text-ghost mt-1">空間に刻まれた、新たな変容を残す</p>
        </div>
        <Link href="/space" className="text-xs text-ghost hover:text-ink transition-colors">
          ← 一覧に戻る
        </Link>
      </div>

      <VersionForm
        branches={branches}
        allVersions={graph.versions}
        defaultBranchId={branch}
      />
    </div>
  );
}
