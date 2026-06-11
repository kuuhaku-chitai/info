/**
 * 空白地帯 - 変容の履歴（公開グラフ閲覧ビュー）
 *
 * 物理空間の変更履歴を、ブランチ・分岐・合流を持つDAG（家系図状）として描画する。
 * 時間は上から下へ流れ、ノードをたどることで空間の変容と記憶をさかのぼれる。
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchVersionGraph } from '@/lib/actions';
import { HistoryView } from '@/components/history/HistoryView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '変容の履歴',
  description: '物理空間の変更履歴を、分岐と合流を持つ家系図として辿る。',
};

export default async function HistoryPage() {
  const graph = await fetchVersionGraph();

  return (
    <div className="relative min-h-screen bg-[var(--color-void)]">
      {/* 静かなヘッダー（グラフの上に浮かべる） */}
      <header className="absolute top-0 left-0 z-10 px-8 py-6 pointer-events-none">
        <Link
          href="/"
          className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors pointer-events-auto"
        >
          空白地帯
        </Link>
        <p className="text-ink text-sm font-light tracking-wide mt-3">変容の履歴</p>
        {graph.versions.length === 0 && (
          <p className="text-ghost text-xs mt-4">まだ記録された変容はありません。</p>
        )}
      </header>

      {/* グラフ本体（全画面。クライアント専用で遅延ロード） */}
      <div className="absolute inset-0">
        <HistoryView data={graph} />
      </div>
    </div>
  );
}
