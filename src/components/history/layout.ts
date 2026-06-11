/**
 * 空白地帯 - DAGレイアウト
 *
 * バージョン（ノード）と親子関係（エッジ）から、各ノードの座標を計算する。
 * dagre等の重いライブラリは使わず、Kahnのトポロジカルソートで「世代（level）」を
 * 求める軽量実装（軽量化最優先）。時間は上から下へ流れる縦レイアウト。
 *
 * level(root) = 0、level(child) = max(level(parents)) + 1（最長経路）。
 * 同じ世代のノードは作成日時順に横へ並べ、時間の連なりを保つ。
 */

import { type VersionRecord, type VersionRelation } from '@/types';

export interface LayoutPosition {
  id: string;
  x: number;
  y: number;
  level: number;
  parentCount: number;
}

const ROW_GAP = 150; // 世代間の縦の余白（広めに取り、空白を生かす）
const COL_GAP = 240; // 同世代内の横の余白

export function computeLayout(
  versions: VersionRecord[],
  relations: VersionRelation[]
): Map<string, LayoutPosition> {
  const ids = versions.map((v) => v.id);
  const idSet = new Set(ids);

  // 親子マップ（存在しないノードを指すエッジは無視）
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const id of ids) {
    parentsOf.set(id, []);
    childrenOf.set(id, []);
    indegree.set(id, 0);
  }
  for (const rel of relations) {
    if (!idSet.has(rel.parentVersionId) || !idSet.has(rel.childVersionId)) continue;
    parentsOf.get(rel.childVersionId)!.push(rel.parentVersionId);
    childrenOf.get(rel.parentVersionId)!.push(rel.childVersionId);
    indegree.set(rel.childVersionId, (indegree.get(rel.childVersionId) ?? 0) + 1);
  }

  // Kahnのトポロジカルソート
  const level = new Map<string, number>();
  for (const id of ids) level.set(id, 0);

  const queue: string[] = [];
  for (const id of ids) {
    if ((indegree.get(id) ?? 0) === 0) queue.push(id);
  }

  const remaining = new Map(indegree);
  const ordered: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    ordered.push(current);
    for (const child of childrenOf.get(current)!) {
      level.set(child, Math.max(level.get(child) ?? 0, (level.get(current) ?? 0) + 1));
      remaining.set(child, (remaining.get(child) ?? 0) - 1);
      if ((remaining.get(child) ?? 0) === 0) queue.push(child);
    }
  }

  // 作成日時の早い順（横並びの基準）
  const createdAtById = new Map(versions.map((v) => [v.id, v.createdAt]));

  // 世代ごとにグループ化
  const byLevel = new Map<number, string[]>();
  for (const id of ids) {
    const lv = level.get(id) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(id);
  }

  const positions = new Map<string, LayoutPosition>();
  for (const [lv, group] of byLevel) {
    group.sort((a, b) => (createdAtById.get(a) ?? '').localeCompare(createdAtById.get(b) ?? ''));
    // 各世代を中央寄せ（負の空間を左右対称に保つ）
    const totalWidth = (group.length - 1) * COL_GAP;
    group.forEach((id, index) => {
      positions.set(id, {
        id,
        x: index * COL_GAP - totalWidth / 2,
        y: lv * ROW_GAP,
        level: lv,
        parentCount: parentsOf.get(id)!.length,
      });
    });
  }

  return positions;
}
