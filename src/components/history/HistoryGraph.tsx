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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { type VersionGraphData } from '@/types';
import { useHistoryStore, type VersionNodeData } from './historyStore';
import { VersionNode } from './VersionNode';
import { DetailPanel } from './DetailPanel';

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
  }, [data, init]);

  const handleNodeClick: NodeMouseHandler<Node<VersionNodeData>> = (_, node) => {
    void selectVersion(node.id);
  };

  return (
    <div className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
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

      <DetailPanel />
    </div>
  );
}
