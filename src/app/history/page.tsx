/**
 * 空白地帯 - 変容の履歴（公開グラフ閲覧ビュー）
 *
 * 物理空間の変更履歴を、ブランチ・分岐・合流を持つDAG（家系図状）として描画する。
 * 時間は上から下へ流れ、ノードをたどることで空間の変容と記憶をさかのぼれる。
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { fetchVersionGraph, fetchAllSocialLinks, fetchPublishedPages } from '@/lib/actions';
import { HistoryView } from '@/components/history/HistoryView';
import { MusicModeToggle } from '@/components/music/MusicModeToggle';
import { DesktopNav } from '@/components/ui/DesktopNav';
import { MobileMenu } from '@/components/ui/MobileMenu';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '変容の履歴',
  description: '物理空間の変更履歴を、分岐と合流を持つ家系図として辿る。',
};

export default async function HistoryPage() {
  const [graph, socialLinks, pages] = await Promise.all([
    fetchVersionGraph(),
    fetchAllSocialLinks(),
    fetchPublishedPages(),
  ]);

  return (
    <div className="void-embrace relative">
      {/* 静かなヘッダー（グラフの上に浮かべる） */}
      <header className="hug-corner-tl z-10 pointer-events-none">
        <Link
          href="/"
          className="text-ghost text-xs tracking-[0.5em] font-light hover:text-ink transition-colors pointer-events-auto"
        >
          空白地帯
        </Link><span className="text-ghost text-xs tracking-[0.5em] font-light"> | 変容の履歴</span>
        {graph.versions.length === 0 && (
          <p className="text-ghost text-[10px] mt-3 pointer-events-none">まだ記録された変容はありません。</p>
        )}
      </header>

      {/* music Mode — 「音」一文字が右上に佇む（空間の記憶を聴く） */}
      <MusicModeToggle />

      {/* グラフ本体（全画面。クライアント専用で遅延ロード） */}
      <div className="absolute inset-0">
        <HistoryView data={graph} />
      </div>

      {/* ナビゲーション — 他ページと同じ左下隅 */}
      <DesktopNav variant="corner" pages={pages} />
      <MobileMenu socialLinks={socialLinks} pages={pages} />
    </div>
  );
}
