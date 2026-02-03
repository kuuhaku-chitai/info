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

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { RigidBody, RapierRigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { FLOOR_BOUNDS, FLOOR_Y } from './floorConfig';

// 徘徊の設定
interface WanderConfig {
  // 移動速度（非常にゆっくり）
  speed: number;
  // 方向転換の滑らかさ
  turnSpeed: number;
}

const DEFAULT_CONFIG: WanderConfig = {
  speed: 0.3,
  turnSpeed: 0.5,
};

interface WanderingCharacterProps {
  modelPath: '/assets/glb/sheep.glb' | '/assets/glb/sheep_person.glb';
  initialPosition?: [number, number, number];
  seed?: number;
  config?: Partial<WanderConfig>;
  // モデルのスケール（デフォルト: 0.5）
  size?: number;
  // Y軸オフセット（床からの高さ調整）
  yOffset?: number;
}

export function WanderingCharacter({
  modelPath,
  initialPosition,
  seed = 0,
  config,
  size = 0.5,
  yOffset = 0,
}: WanderingCharacterProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const rigidBodyRef = useRef<RapierRigidBody>(null);
  const groupRef = useRef<THREE.Group>(null);

  // 床の上に立つY位置を計算
  // FLOOR_Y は床面の位置（-2）、キャラクターはその上に立つ
  const groundY = FLOOR_Y + 0.5 + yOffset;

  // 境界設定（floorConfigから取得）
  const boundaryX: [number, number] = [FLOOR_BOUNDS.x.min, FLOOR_BOUNDS.x.max];
  const boundaryZ: [number, number] = [FLOOR_BOUNDS.z.min, FLOOR_BOUNDS.z.max];

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
    if (initialPosition) {
      // initialPositionが指定されている場合、Y座標はgroundYを使用
      return [initialPosition[0], groundY, initialPosition[2]];
    }
    const x = boundaryX[0] + Math.random() * (boundaryX[1] - boundaryX[0]);
    const z = boundaryZ[0] + Math.random() * (boundaryZ[1] - boundaryZ[0]);
    return [x, groundY, z];
  }, [initialPosition, boundaryX, boundaryZ, groundY]);

  useFrame((_, delta) => {
    if (!rigidBodyRef.current || !groupRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    // Perlin Noiseで目標角度を有機的に変化させる
    const noiseValue = noise2D(t * 0.1 + seed, seed);
    targetAngleRef.current += noiseValue * delta * 0.5;

    // 現在位置を取得
    const pos = rigidBodyRef.current.translation();

    // 境界チェック: 壁に近づいたら目標角度を調整
    const wallMargin = 1.0;
    if (pos.x < boundaryX[0] + wallMargin) {
      targetAngleRef.current = 0; // 右へ向かわせる
    } else if (pos.x > boundaryX[1] - wallMargin) {
      targetAngleRef.current = Math.PI; // 左へ向かわせる
    }
    if (pos.z < boundaryZ[0] + wallMargin * 0.5) {
      targetAngleRef.current = Math.PI / 2; // 奥へ向かわせる
    } else if (pos.z > boundaryZ[1] - wallMargin * 0.5) {
      targetAngleRef.current = -Math.PI / 2; // 手前へ向かわせる
    }

    // ===== 生物学的に自然な動作の実装 =====
    // 生物は「まず向きを変えて」から「その向いている方向に進む」

    // 現在のモデルの向き
    const currentFacingAngle = groupRef.current.rotation.y;

    // 現在の向きから目標向きへの差分を計算
    let angleDiffToTarget = targetAngleRef.current - currentFacingAngle;

    // 最短経路で回転するように正規化（-π 〜 π）
    while (angleDiffToTarget > Math.PI) angleDiffToTarget -= Math.PI * 2;
    while (angleDiffToTarget < -Math.PI) angleDiffToTarget += Math.PI * 2;

    // 回転速度を計算（向きの差が大きいほど速く回転）
    const rotationSpeed = mergedConfig.turnSpeed * 2;
    const rotationAmount = Math.sign(angleDiffToTarget) *
      Math.min(Math.abs(angleDiffToTarget), rotationSpeed * delta);

    // モデルの向きを更新
    groupRef.current.rotation.y += rotationAmount;

    // 内部の現在角度も更新（同期を保つ）
    currentAngleRef.current = groupRef.current.rotation.y;

    // ===== 移動: 顔が向いている方向にのみ移動 =====
    // 向きの差が大きい場合は移動を抑制（まず回転を優先）
    const facingAlignment = Math.cos(angleDiffToTarget); // 1.0 = 完全に合っている, 0 = 90度ずれ, -1 = 真後ろ
    const movementFactor = Math.max(0, facingAlignment); // 後ろ向きへの移動は禁止

    // 向いている方向に基づいて移動方向を計算
    // GLBモデルの前方が -Z 方向のため、符号を反転
    const facingX = -Math.sin(groupRef.current.rotation.y);
    const facingZ = -Math.cos(groupRef.current.rotation.y);

    // 移動速度（向きのずれが小さいほど速く移動）
    const effectiveSpeed = mergedConfig.speed * movementFactor;

    // 次の位置を計算（顔の向きに直線移動）
    let newX = pos.x + facingX * effectiveSpeed * delta;
    let newZ = pos.z + facingZ * effectiveSpeed * delta;

    // 境界クランプ
    newX = Math.max(boundaryX[0], Math.min(boundaryX[1], newX));
    newZ = Math.max(boundaryZ[0], Math.min(boundaryZ[1], newZ));

    // 位置を更新
    rigidBodyRef.current.setNextKinematicTranslation({
      x: newX,
      y: groundY,
      z: newZ,
    });
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
      <CapsuleCollider args={[0.3 * size, 0.2 * size]} position={[0, 0.5 * size, 0]} />

      <group ref={groupRef} scale={size}>
        <primitive object={clonedScene} />
      </group>
    </RigidBody>
  );
}

// モデルのプリロード
useGLTF.preload('/assets/glb/sheep.glb');
useGLTF.preload('/assets/glb/sheep_person.glb');
