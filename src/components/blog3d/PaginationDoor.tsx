'use client';

/**
 * PaginationDoor - ページ遷移の扉
 *
 * 5個以上の記事がある場合、次のページへの「扉」を配置。
 * 空間を移動する感覚でページネーションを表現。
 * 「未完の台形」を維持した歪んだ扉のデザイン。
 */

import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

interface PaginationDoorProps {
  direction: 'next' | 'prev';
  currentPage: number;
  totalPages: number;
  onClick: () => void;
  position?: [number, number, number];
}

export function PaginationDoor({
  direction,
  currentPage,
  totalPages,
  onClick,
  position = [0, 0, 0],
}: PaginationDoorProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  // 微かな浮遊アニメーション
  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.position.y = position[1] + Math.sin(t * 0.5) * 0.05;
  });

  // 扉の位置: 右端（next）または左端（prev）
  const doorX = direction === 'next' ? 5 : -5;
  const doorRotation = direction === 'next' ? -0.1 : 0.1;

  const label = direction === 'next' ? '→ 次の部屋' : '前の部屋 ←';
  const pageInfo = `${currentPage + 1} / ${totalPages}`;

  return (
    <group
      ref={groupRef}
      position={[doorX, position[1], position[2]]}
      rotation={[0, doorRotation, 0]}
    >
      {/* 扉のフレーム: 台形形状 */}
      <mesh
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={onClick}
      >
        {/* 歪んだ四角形（台形）を頂点で定義 */}
        <shapeGeometry
          args={[
            (() => {
              const shape = new THREE.Shape();
              // 下部が広く、上部が狭い台形
              shape.moveTo(-0.8, -1.5);
              shape.lineTo(0.75, -1.5);
              shape.lineTo(0.65, 1.5);
              shape.lineTo(-0.7, 1.5);
              shape.closePath();
              return shape;
            })(),
          ]}
        />
        <meshBasicMaterial
          color={hovered ? '#1A1A1A' : '#FAFAFA'}
          side={THREE.DoubleSide}
          transparent
          opacity={hovered ? 0.9 : 0.7}
        />
      </mesh>

      {/* 扉の枠線 */}
      <lineLoop>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([
              -0.8, -1.5, 0.01,
              0.75, -1.5, 0.01,
              0.65, 1.5, 0.01,
              -0.7, 1.5, 0.01,
            ]), 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#1A1A1A" opacity={0.5} transparent />
      </lineLoop>

      {/* ラベル: HTMLで表示 */}
      <Html
        position={[0, 0, 0.1]}
        center
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="text-center transition-colors duration-300"
          style={{
            color: hovered ? '#FAFAFA' : '#1A1A1A',
            fontSize: '12px',
            fontWeight: 300,
            letterSpacing: '0.1em',
            whiteSpace: 'nowrap',
          }}
        >
          <div>{label}</div>
          <div
            className="mt-1 opacity-50"
            style={{ fontSize: '10px' }}
          >
            {pageInfo}
          </div>
        </div>
      </Html>

      {/* 扉の取っ手（微かな存在） */}
      <mesh position={[direction === 'next' ? 0.4 : -0.4, 0, 0.05]}>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial
          color={hovered ? '#FAFAFA' : '#1A1A1A'}
          opacity={0.4}
          transparent
        />
      </mesh>
    </group>
  );
}
