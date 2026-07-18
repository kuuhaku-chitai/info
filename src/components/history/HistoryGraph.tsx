'use client';

/**
 * 空白地帯 - 履歴グラフ（DAG本体）
 *
 * React Flow でバージョンをノード、親子関係をエッジとして描画する。
 * ノードクリックで詳細パネルを開く。背景は細かなドットで、余白を主役に保つ。
 *
 * このコンポーネントは ssr:false で動的ロードされる（HistoryView 経由）。
 * @xyflow/react は重量級だが、サーバー(Worker)バンドルには載らない。
 */

import { useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type NodeMouseHandler,
  type Node,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type VersionGraphData } from '@/types';
import { visualizerBus } from '@/components/music/visualizerBus';
import { useHistoryStore, type VersionNodeData } from './historyStore';
import { VersionNode } from './VersionNode';
import { DetailPanel } from './DetailPanel';
import { MemoryCanvas } from './MemoryCanvas';

/** React Flowの視点をvisualizerBusへ（記憶の粒がズーム・パンに追従する唯一の経路） */
function publishViewport(viewport: Viewport): void {
  visualizerBus.viewport = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
}

/** onInit：fitView直後の初期視点をseedする（これが無いと初回描画がずれる） */
function handleFlowInit(instance: { getViewport(): Viewport }): void {
  publishViewport(instance.getViewport());
}

/** onMove：パン・ズーム中の視点を毎イベント発行（rAF側は読むだけ） */
function handleFlowMove(_event: unknown, viewport: Viewport): void {
  publishViewport(viewport);
}

const nodeTypes = { version: VersionNode };

interface HistoryGraphProps {
  data: VersionGraphData;
}

export function HistoryGraph({ data }: HistoryGraphProps) {
  const nodes = useHistoryStore((s) => s.nodes);
  const edges = useHistoryStore((s) => s.edges);
  const onNodesChange = useHistoryStore((s) => s.onNodesChange);
  const onEdgesChange = useHistoryStore((s) => s.onEdgesChange);
  const selectVersion = useHistoryStore((s) => s.selectVersion);
  const init = useHistoryStore((s) => s.init);

  useEffect(() => {
    init(data);
    // URLハッシュに一致するバージョンIDがあればパネルを自動オープン
    // トップページの /history#versionId リンクからの遷移に対応
    const hash = window.location.hash.slice(1);
    if (hash && data.versions.some((v) => v.id === hash)) {
      void selectVersion(hash);
    }
  }, [data, init, selectVersion]);

  const handleNodeClick: NodeMouseHandler<Node<VersionNodeData>> = (_, node) => {
    void selectVersion(node.id);
  };

  return (
    // overflow-hidden：絶対配置の子（Canvas等）が何をしても
    // ページのスクロールバーを生まないための防御壁
    <div className="absolute inset-0 overflow-hidden">
      {/* 記憶の粒：ReactFlowの下層。再生中だけ、world座標で粒が漂う */}
      <MemoryCanvas />

      {/* history-breath: music Mode再生中のみ、音のエネルギーでグラフが微かに呼吸する
          （--music-energy はuseEnsembleが書き込むCSS変数。音が止まれば完全に静止）。
          opacity<1 はCSS上「新しいスタッキングコンテキスト」を生むため、
          fixed位置のDetailPanel閉じるボタン（z-60、ハンバーガーz-50より上に出す前提）を
          このスコープの外に置く——内側に置くとz-60がこの中に閉じ込められ、
          外側のハンバーガーと正しく比較されなくなる（実際に起きていた不具合）。 */}
      <div className="absolute inset-0 history-breath">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onInit={handleFlowInit}
          onMove={handleFlowMove}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.2}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="var(--color-edge)" gap={32} size={1} />
          <Controls showInteractive={false} position="bottom-right" />
        </ReactFlow>
      </div>

      <DetailPanel />
    </div>
  );
}
