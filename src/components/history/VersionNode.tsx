'use client';

/**
 * 空白地帯 - バージョンノード（変更1件の表象）
 *
 * グラフ上の1ノード。主張しすぎないよう、小さく・細い線で・余白を持って置く。
 * 複数の親を持つ（=マージ/合流）場合のみ、静かに「合流」と添える。
 */

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { type VersionNodeData } from './historyStore';

export function VersionNode({ data, selected }: NodeProps<Node<VersionNodeData>>) {
  const isMerge = data.parentCount > 1;

  return (
    <div
      className={`
        w-44 px-4 py-3 rounded bg-[var(--color-void)] transition-all duration-700
        ${selected ? 'border border-ink' : 'border border-edge'}
      `}
      // 記憶の風化: 古いノードほど淡く。選択中は焦点を保つため全不透明に戻す
      style={{ opacity: selected ? 1 : data.opacity }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-1 !h-1 !bg-ghost !border-0"
      />

      <p className="text-[10px] text-ghost mb-1 truncate">{data.branchName}</p>
      <p className="text-xs text-ink font-light leading-snug line-clamp-2">{data.title}</p>
      {isMerge && (
        <p className="text-[9px] text-ghost mt-2 tracking-wide">合流（{data.parentCount}）</p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1 !h-1 !bg-ghost !border-0"
      />
    </div>
  );
}
