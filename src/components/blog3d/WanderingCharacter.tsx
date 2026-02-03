'use client';

/**
 * WanderingCharacter - 徘徊するキャラクター
 *
 * sheep.glb / sheep_person.glb を読み込み、
 * 空間をゆっくりと徘徊するキャラクターを実装。
 * Kinematicコライダーを持ち、記事に「ぶつかる」ことで揺らす。
 *
 * 動きは「微弱で有機的」- 急な方向転換やスピードの変化は禁止。
 */

import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

// 徘徊の設定
interface WanderConfig {
  // 移動速度（非常にゆっくり）
  speed: number;
  // 方向転換の滑らかさ
  turnSpeed: number;
  // 徘徊範囲
  boundaryX: [number, number];
  boundaryZ: [number, number];
  // Y位置（地面）
  groundY: number;
}

const DEFAULT_CONFIG: WanderConfig = {
  speed: 0.3,
  turnSpeed: 0.5,
  boundaryX: [-5, 5],
  boundaryZ: [-2, 2],
  groundY: -1.5,
};

interface WanderingCharacterProps {
  modelPath: '/assets/glb/sheep.glb' | '/assets/glb/sheep_person.glb';
  initialPosition?: [number, number, number];
  seed?: number;
  config?: Partial<WanderConfig>;
}

export function WanderingCharacter({
  modelPath,
  initialPosition,
  seed = 0,
  config,
}: WanderingCharacterProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<THREE.Group>(null);

  // GLTFモデルをロード
  const { scene } = useGLTF(modelPath);

  // モデルのクローンを作成（複数インスタンス対応）
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  // ノイズによる有機的な徘徊
  const noise2D = useMemo(() => createNoise2D(), []);
  const timeRef = useRef(seed * 100);
  const targetAngleRef = useRef(Math.random() * Math.PI * 2);
  const currentAngleRef = useRef(targetAngleRef.current);

  // 初期位置
  const startPosition = useMemo<[number, number, number]>(() => {
    if (initialPosition) return initialPosition;
    const x = mergedConfig.boundaryX[0] + Math.random() * (mergedConfig.boundaryX[1] - mergedConfig.boundaryX[0]);
    const z = mergedConfig.boundaryZ[0] + Math.random() * (mergedConfig.boundaryZ[1] - mergedConfig.boundaryZ[0]);
    return [x, mergedConfig.groundY, z];
  }, [initialPosition, mergedConfig]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    // Perlin Noiseで目標角度を有機的に変化させる
    const noiseValue = noise2D(t * 0.1 + seed, seed);
    targetAngleRef.current += noiseValue * delta * 0.5;

    // 現在の角度を目標角度に向けてスムーズに補間
    const angleDiff = targetAngleRef.current - currentAngleRef.current;
    currentAngleRef.current += angleDiff * mergedConfig.turnSpeed * delta;

    // 移動方向の計算
    const dirX = Math.cos(currentAngleRef.current);
    const dirZ = Math.sin(currentAngleRef.current);

    // 現在位置を取得
    const pos = rigidBodyRef.current.translation();

    // 境界チェック: 端に近づいたら反対方向に向かう
    let newTargetAngle = targetAngleRef.current;
    if (pos.x < mergedConfig.boundaryX[0] + 1) {
      newTargetAngle = 0; // 右へ
    } else if (pos.x > mergedConfig.boundaryX[1] - 1) {
      newTargetAngle = Math.PI; // 左へ
    }
    if (pos.z < mergedConfig.boundaryZ[0] + 0.5) {
      newTargetAngle = Math.PI / 2; // 奥へ
    } else if (pos.z > mergedConfig.boundaryZ[1] - 0.5) {
      newTargetAngle = -Math.PI / 2; // 手前へ
    }
    targetAngleRef.current = newTargetAngle;

    // 次の位置を計算（Kinematicなので直接位置を設定）
    const newX = pos.x + dirX * mergedConfig.speed * delta;
    const newZ = pos.z + dirZ * mergedConfig.speed * delta;

    rigidBodyRef.current.setNextKinematicTranslation({
      x: newX,
      y: mergedConfig.groundY,
      z: newZ,
    });

    // モデルの向きを移動方向に合わせる
    if (groupRef.current) {
      groupRef.current.rotation.y = -currentAngleRef.current + Math.PI / 2;
    }
  });

  return (
    <RigidBody
      ref={rigidBodyRef}
      type="kinematicPosition"
      position={startPosition}
      colliders={false}
    >
      {/* カプセルコライダー: キャラクターの当たり判定 */}
      {/* 記事に接触すると、記事が物理的に押される */}
      <CapsuleCollider args={[0.3, 0.2]} position={[0, 0.5, 0]} />

      <group ref={groupRef} scale={0.5}>
        <primitive object={clonedScene} />
      </group>
    </RigidBody>
  );
}

// モデルのプリロード
useGLTF.preload('/assets/glb/sheep.glb');
useGLTF.preload('/assets/glb/sheep_person.glb');
