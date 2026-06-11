/**
 * 空白地帯 - 空間バージョン管理（CMS概要）
 *
 * 物理空間の「変更履歴（Gitのコミット）」と「ブランチ」を管理する。
 * ブランチはインラインで管理し、変更（バージョン）は専用フォームで記録する。
 */

import Link from 'next/link';
import { fetchAllBranches, fetchVersionGraph } from '@/lib/actions';
import { BranchManager } from './BranchManager';
import { DeleteVersionButton } from './DeleteVersionButton';

export const dynamic = 'force-dynamic';

export default async function SpacePage() {
  const [branches, graph] = await Promise.all([fetchAllBranches(), fetchVersionGraph()]);
  const { versions, relations } = graph;

  // ブランチごとの変更件数
  const versionCounts: Record<string, number> = {};
  for (const v of versions) {
    versionCounts[v.branchId] = (versionCounts[v.branchId] ?? 0) + 1;
  }

  // 各バージョンの親数（複数 = マージ）
  const parentCount: Record<string, number> = {};
  for (const r of relations) {
    parentCount[r.childVersionId] = (parentCount[r.childVersionId] ?? 0) + 1;
  }

  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const sortedVersions = [...versions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-10">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium text-ink tracking-wide">空間のバージョン管理</h1>
          <p className="text-xs text-ghost mt-1">
            物理空間の変容を、ブランチと変更履歴として記録する
          </p>
        </div>
        <Link
          href="/space/new"
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity"
        >
          変更を記録
        </Link>
      </div>

      {/* ブランチ管理 */}
      <section className="space-y-4">
        <h2 className="text-sm font-light text-ink tracking-wide">ブランチ</h2>
        <BranchManager branches={branches} versionCounts={versionCounts} />
      </section>

      {/* 変更履歴一覧 */}
      <section className="space-y-4">
        <h2 className="text-sm font-light text-ink tracking-wide">
          変更履歴 <span className="text-xs text-ghost">（{versions.length}件）</span>
        </h2>

        {sortedVersions.length === 0 ? (
          <p className="text-sm text-ghost py-8 text-center">まだ変更履歴がありません</p>
        ) : (
          <div className="border border-edge rounded overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-edge bg-void">
                  <th className="text-left px-4 py-3 text-xs text-ghost font-normal">タイトル</th>
                  <th className="text-left px-4 py-3 text-xs text-ghost font-normal">ブランチ</th>
                  <th className="text-left px-4 py-3 text-xs text-ghost font-normal">派生元</th>
                  <th className="text-left px-4 py-3 text-xs text-ghost font-normal">記録日</th>
                  <th className="text-right px-4 py-3 text-xs text-ghost font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {sortedVersions.map((v) => {
                  const parents = parentCount[v.id] ?? 0;
                  return (
                    <tr
                      key={v.id}
                      className="border-b border-edge last:border-b-0 hover:bg-[var(--color-void)]"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/space/${v.id}`}
                          className="text-ink hover:opacity-70 transition-opacity"
                        >
                          {v.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-xs text-ghost">
                        {branchNameById.get(v.branchId) ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-ghost">
                        {parents === 0 ? 'ルート' : parents > 1 ? `合流（${parents}）` : '1'}
                      </td>
                      <td className="px-4 py-3 text-xs text-ghost">
                        {v.createdAt.slice(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/space/${v.id}`}
                            className="px-3 py-1 text-xs text-ghost hover:text-ink transition-colors"
                          >
                            編集
                          </Link>
                          <DeleteVersionButton id={v.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
