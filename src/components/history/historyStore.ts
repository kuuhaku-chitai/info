'use client';

/**
 * 空白地帯 - 履歴グラフのZustandストア
 *
 * React Flow のノード/エッジ状態と、詳細パネルの状態を管理する。
 * 詳細（画像・記憶・本文）はノードクリック時に Server Action で遅延取得する
 * （初期ロードを軽く保ち、必要な分だけ静かに引き寄せる）。
 */

import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';
import { type VersionGraphData, type VersionRecordDetail } from '@/types';
import { fetchVersionDetail } from '@/lib/actions';
import { computeLayout } from './layout';

export interface VersionNodeData extends Record<string, unknown> {
  title: string;
  branchName: string;
  parentCount: number;
  /** 記憶の風化: 古いノードほど低く（最古でも読めるよう下限あり）。0..1 */
  opacity: number;
}

/** 最古を最も淡く、最新を濃く。createdAtを正規化して不透明度に写す */
function computeOpacities(createdAts: string[]): number[] {
  const MIN_OPACITY = 0.35; // 最古のノードでも読める下限
  const times = createdAts.map((d) => Date.parse(d) || 0);
  const min = Math.min(...times);
  const max = Math.max(...times);
  if (!isFinite(min) || max === min) {
    return createdAts.map(() => 1);
  }
  return times.map((t) => {
    const ratio = (t - min) / (max - min); // 0=最古, 1=最新
    return MIN_OPACITY + (1 - MIN_OPACITY) * ratio;
  });
}

interface HistoryStore {
  nodes: Node<VersionNodeData>[];
  edges: Edge[];
  selectedId: string | null;
  detail: VersionRecordDetail | null;
  loadingDetail: boolean;
  init: (data: VersionGraphData) => void;
  onNodesChange: (changes: NodeChange<Node<VersionNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  selectVersion: (id: string) => Promise<void>;
  closeDetail: () => void;
}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  detail: null,
  loadingDetail: false,

  init: (data) => {
    const { branches, versions, relations } = data;
    const positions = computeLayout(versions, relations);
    const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
    const idSet = new Set(versions.map((v) => v.id));

    // 記憶の風化: createdAtを基準に各ノードの不透明度を決める
    const opacities = computeOpacities(versions.map((v) => v.createdAt));

    const nodes: Node<VersionNodeData>[] = versions.map((v, i) => {
      const pos = positions.get(v.id);
      return {
        id: v.id,
        type: 'version',
        position: { x: pos?.x ?? 0, y: pos?.y ?? 0 },
        draggable: false,
        data: {
          title: v.title,
          branchName: branchNameById.get(v.branchId) ?? '—',
          parentCount: pos?.parentCount ?? 0,
          opacity: opacities[i],
        },
      };
    });

    const edges: Edge[] = relations
      .filter((r) => idSet.has(r.parentVersionId) && idSet.has(r.childVersionId))
      .map((r) => ({
        id: `${r.parentVersionId}__${r.childVersionId}`,
        source: r.parentVersionId,
        target: r.childVersionId,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--color-ghost)', strokeWidth: 1 },
      }));

    set({ nodes, edges });
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  selectVersion: async (id) => {
    set({
      selectedId: id,
      loadingDetail: true,
      // 選択ノードに selected フラグを立てる（描画で淡く強調）
      nodes: get().nodes.map((n) => ({ ...n, selected: n.id === id })),
    });
    try {
      const detail = await fetchVersionDetail(id);
      // 取得中に別ノードへ切り替わっていなければ反映
      if (get().selectedId === id) {
        set({ detail, loadingDetail: false });
      }
    } catch {
      if (get().selectedId === id) {
        set({ detail: null, loadingDetail: false });
      }
    }
  },

  closeDetail: () => {
    set({
      selectedId: null,
      detail: null,
      loadingDetail: false,
      nodes: get().nodes.map((n) => ({ ...n, selected: false })),
    });
  },
}));
