'use client';

/**
 * HangingPost - 吊るされた記事コンポーネント
 *
 * 物理的に天井から紐で吊るされた箱として記事を表現。
 * 各インスタンスは微妙に異なる紐の長さと揺れの特性を持つ。
 * 「未完の台形」を保つ不規則なポリゴン形状。
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import {
  RigidBody,
  RapierRigidBody,
  useSphericalJoint,
  BallCollider,
} from '@react-three/rapier';
import * as THREE from 'three';
import type { Post } from '@/types';

// ポストUI: 3D空間内でHTMLをレンダリング
// コンセプト: 「都市に吊るされた思考の断片」
interface PostUIProps {
  post: Post;
  onClick: () => void;
}

function PostUI({ post, onClick }: PostUIProps) {
  const categoryLabels: Record<string, string> = {
    article: '記事',
    note: 'メモ',
    event: 'イベント',
  };

  return (
    <div
      onClick={onClick}
      className="cursor-pointer select-none transition-opacity duration-300 hover:opacity-80"
      style={{
        // 「未完の台形」を clip-path で表現
        // 各ポストで異なる傾きを持たせ、不均質さを演出
        clipPath: 'polygon(2% 0%, 100% 3%, 98% 100%, 0% 97%)',
        background: '#FFFFFF',
        border: '1px solid #1A1A1A',
        padding: '16px 20px',
        width: '240px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <time className="text-[10px] text-ghost tracking-wider">
          {new Date(post.date).toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </time>
        <span className="text-[10px] text-ghost opacity-50">
          {categoryLabels[post.category]}
        </span>
      </div>
      <h2 className="text-sm font-light text-ink tracking-wide leading-snug">
        {post.title}
      </h2>
      {post.markdown && (
        <p className="text-xs text-ghost mt-2 line-clamp-2 leading-relaxed">
          {post.markdown.slice(0, 60)}
          {post.markdown.length > 60 && '...'}
        </p>
      )}
    </div>
  );
}

// ロープの視覚的表現
// 天井の固定点からRigidBodyの位置までを結ぶ
interface RopeVisualProps {
  anchorPosition: THREE.Vector3;
  bodyRef: React.RefObject<RapierRigidBody | null>;
}

function RopeVisual({ anchorPosition, bodyRef }: RopeVisualProps) {
  const lineRef = useRef<THREE.Line>(null!);
  const points = useMemo(() => [new THREE.Vector3(), new THREE.Vector3()], []);
  const geometry = useMemo(
    () => new THREE.BufferGeometry().setFromPoints(points),
    [points]
  );
  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: '#1A1A1A', opacity: 0.4, transparent: true }),
    []
  );

  useFrame(() => {
    if (!lineRef.current || !bodyRef.current) return;

    const bodyPos = bodyRef.current.translation();

    // 始点: アンカー（天井）
    points[0].copy(anchorPosition);
    // 終点: 物理ボディの位置
    points[1].set(bodyPos.x, bodyPos.y, bodyPos.z);

    geometry.setFromPoints(points);
    geometry.attributes.position.needsUpdate = true;
  });

  return <primitive object={new THREE.Line(geometry, material)} ref={lineRef} />
}

interface HangingPostProps {
  post: Post;
  index: number;
  totalPosts: number;
  onPostClick: (post: Post) => void;
  // 外部から風の力を受け取る
  windForce?: THREE.Vector3;
}

export function HangingPost({
  post,
  index,
  totalPosts,
  onPostClick,
  windForce,
}: HangingPostProps) {
  // 非nullアサーションで初期化（Rapierの要件）
  const bodyRef = useRef<RapierRigidBody>(null!);
  const anchorRef = useRef<RapierRigidBody>(null!);

  // 個体差を持たせるためのシード値
  // 紐の長さ、初期位置、揺れの感受性にばらつきを与える
  const seed = useMemo(() => {
    const hash = post.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return hash / 1000;
  }, [post.id]);

  // 水平配置: 画面幅に応じて分散
  const spreadWidth = 6;
  const xOffset = useMemo(() => {
    if (totalPosts === 1) return 0;
    const baseX = ((index / (totalPosts - 1)) - 0.5) * spreadWidth;
    // 個体差による微小なずれ
    return baseX + (Math.sin(seed * 10) * 0.3);
  }, [index, totalPosts, seed, spreadWidth]);

  // 紐の長さ: 2.0〜3.5の範囲でランダム
  const ropeLength = useMemo(() => 2.0 + (seed % 1) * 1.5, [seed]);

  // アンカー（天井の固定点）位置
  const anchorPosition = useMemo(
    () => new THREE.Vector3(xOffset, 4, (seed % 0.5) - 0.25),
    [xOffset, seed]
  );

  // ボディの初期位置（アンカーから紐の長さ分下）
  const bodyInitialPosition = useMemo(
    () => new THREE.Vector3(xOffset, 4 - ropeLength, (seed % 0.5) - 0.25),
    [xOffset, ropeLength, seed]
  );

  // Spherical Joint: 天井の固定点と記事ボディを接続
  useSphericalJoint(anchorRef, bodyRef, [
    [0, 0, 0],
    [0, ropeLength, 0],
  ]);

  // 風の力を適用
  useFrame(() => {
    if (!bodyRef.current || !windForce) return;

    // 個体ごとの風への感受性（0.8〜1.2）
    const sensitivity = 0.8 + (seed % 0.4);

    bodyRef.current.applyImpulse(
      {
        x: windForce.x * sensitivity * 0.01,
        y: windForce.y * sensitivity * 0.005,
        z: windForce.z * sensitivity * 0.01,
      },
      true
    );
  });

  function handleClick() {
    onPostClick(post);
  }

  return (
    <>
      {/* アンカー（天井の固定点）: 完全に固定 */}
      <RigidBody
        ref={anchorRef}
        type="fixed"
        position={anchorPosition.toArray()}
        colliders={false}
      >
        {/* 小さな球で固定点を視覚化（ほぼ見えない） */}
        <mesh>
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color="#1A1A1A" opacity={0.3} transparent />
        </mesh>
      </RigidBody>

      {/* 記事ボディ: 物理演算の対象 */}
      <RigidBody
        ref={bodyRef}
        position={bodyInitialPosition.toArray()}
        colliders={false}
        // 減衰を調整: 揺れが長く余韻を残す
        linearDamping={0.3}
        angularDamping={0.5}
        // 質量は軽め（紙のように）
        mass={0.5}
      >
        {/* コライダー: 他のオブジェクト（キャラクター）との衝突検出用 */}
        <BallCollider args={[0.8]} />

        {/* HTML UI: 3D空間に配置されたブログカード */}
        <Html
          transform
          occlude="blending"
          style={{ pointerEvents: 'auto' }}
          center
        >
          <PostUI post={post} onClick={handleClick} />
        </Html>
      </RigidBody>

      {/* ロープの視覚表現 */}
      <RopeVisual anchorPosition={anchorPosition} bodyRef={bodyRef} />
    </>
  );
}
