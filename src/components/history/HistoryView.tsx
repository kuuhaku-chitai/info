'use client';

/**
 * 空白地帯 - HistoryView（グラフのクライアント専用ローダー）
 *
 * @xyflow/react と zustand をサーバー(Worker)バンドルへ載せないため、
 * ssr:false で HistoryGraph を遅延ロードする（mermaidと同じ方針）。
 */

import dynamic from 'next/dynamic';
import { type VersionGraphData } from '@/types';

const HistoryGraph = dynamic(
  () => import('./HistoryGraph').then((m) => m.HistoryGraph),
  {
    ssr: false,
    loading: () => (
      // 読み込み中も「空白」を保つ静かなプレースホルダ
      <div className="absolute inset-0" aria-hidden="true" />
    ),
  }
);

interface HistoryViewProps {
  data: VersionGraphData;
}

export function HistoryView({ data }: HistoryViewProps) {
  return <HistoryGraph data={data} />;
}
