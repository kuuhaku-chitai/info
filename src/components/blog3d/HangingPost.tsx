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
import { FLOOR_BOUNDS, CEILING_Y } from './floorConfig';

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
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
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
  // 記事カードのスケール（1.0がデフォルト）
  scale?: number;
}

export function HangingPost({
  post,
  index,
  totalPosts,
  onPostClick,
  windForce,
  scale = 1.0,
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

  // 3D空間での配置計算: 床の境界全体を使い、ランダムに配置
  // 境界はfloorConfigで定義（マージン込み）
  const { xOffset, zOffset, ropeLength } = useMemo(() => {
    // 記事が1つしかない場合は中心に配置（見つけやすくするため）
    if (totalPosts === 1) {
      const centerX = (FLOOR_BOUNDS.x.min + FLOOR_BOUNDS.x.max) / 2;
      const centerZ = (FLOOR_BOUNDS.z.min + FLOOR_BOUNDS.z.max) / 2;
      return {
        xOffset: centerX,
        zOffset: centerZ,
        ropeLength: 2.5, // 中程度の紐の長さ
      };
    }

    // シード値から決定論的なランダム値を生成
    // これにより同じ記事は常に同じ位置に配置される
    const randomX = (Math.sin(seed * 17 + index * 7) + 1) / 3; // 0〜1
    const randomZ = (Math.cos(seed * 23 + index * 11) + 1) / 2; // 0〜1
    const randomRope = (Math.sin(seed * 31 + index * 13) + 1) / 2; // 0〜1

    // X座標: 床の幅全体にランダム配置（マージン内）
    const xPos = FLOOR_BOUNDS.x.min + randomX * (FLOOR_BOUNDS.x.max - FLOOR_BOUNDS.x.min);

    // Z座標: 床の奥行き全体にランダム配置（マージン内）
    const zPos = FLOOR_BOUNDS.z.min + randomZ * (FLOOR_BOUNDS.z.max - FLOOR_BOUNDS.z.min);

    // 紐の長さ: 1.5〜4.0の範囲でランダム（高さの変化をより大きく）
    const ropeLengthCalc = 1.5 + randomRope * 2.5;

    return {
      xOffset: xPos,
      zOffset: zPos,
      ropeLength: ropeLengthCalc,
    };
  }, [index, seed, totalPosts]);

  // アンカー（天井の固定点）位置
  const anchorPosition = useMemo(
    () => new THREE.Vector3(xOffset, CEILING_Y, zOffset),
    [xOffset, zOffset]
  );

  // ボディの初期位置（アンカーから紐の長さ分下）
  const bodyInitialPosition = useMemo(
    () => new THREE.Vector3(xOffset, CEILING_Y - ropeLength, zOffset),
    [xOffset, ropeLength, zOffset]
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
        {/* scaleプロパティでポリゴンと文字サイズを比率維持で拡大縮小 */}
        {/* Htmlコンポーネントのscaleプロパティを使用することで、div領域も含めて正しくスケーリング */}
        <Html
          transform
          occlude="blending"
          scale={scale}
          style={{
            pointerEvents: 'auto',
          }}
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
