'use client';

/**
 * WindSystem - 微風システム
 *
 * Perlin Noiseを使用して、空間全体に「微弱で有機的」な風を生成。
 * この風が吊るされた記事を常に揺らし続ける。
 * 派手な動きは禁止 - すべては「消えかけた存在」のように振る舞う。
 */

import { useRef, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { createNoise2D } from 'simplex-noise';
import * as THREE from 'three';

// 風の設定: 「微弱で有機的」を実現するパラメータ
interface WindConfig {
  // ノイズのスケール（大きいほどゆっくりした変化）
  noiseScale: number;
  // 風の最大強度
  maxForce: number;
  // 風の変化速度
  timeScale: number;
}

const DEFAULT_CONFIG: WindConfig = {
  noiseScale: 0.3,
  maxForce: 0.015, // 非常に弱い風
  timeScale: 0.2,  // ゆっくりとした変化
};

interface WindSystemProps {
  // 風の力を受け取るコールバック
  onWindUpdate: (force: THREE.Vector3) => void;
  config?: Partial<WindConfig>;
}

export function WindSystem({ onWindUpdate, config }: WindSystemProps) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const timeRef = useRef(0);

  // Simplex Noise 2Dインスタンス
  // X方向とZ方向それぞれにノイズを適用
  const noise2DRef = useRef(createNoise2D());

  useFrame((_, delta) => {
    timeRef.current += delta * mergedConfig.timeScale;
    const t = timeRef.current;

    // X方向の風: ゆるやかな揺らぎ
    const windX = noise2DRef.current(t * mergedConfig.noiseScale, 0) * mergedConfig.maxForce;

    // Z方向の風: X方向とは異なる周期で変化
    const windZ = noise2DRef.current(0, t * mergedConfig.noiseScale + 100) * mergedConfig.maxForce;

    // Y方向: わずかな上下の揺らぎ（浮遊感）
    const windY = noise2DRef.current(t * mergedConfig.noiseScale * 0.5, 50) * mergedConfig.maxForce * 0.3;

    onWindUpdate(new THREE.Vector3(windX, windY, windZ));
  });

  // このコンポーネント自体は何もレンダリングしない
  return null;
}

/**
 * useWind Hook
 *
 * WindSystemを使わずに、Hookとして風の力を取得したい場合に使用。
 * 複数のコンポーネントで風の状態を共有する場合に便利。
 */
export function useWind(config?: Partial<WindConfig>) {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const windForceRef = useRef(new THREE.Vector3());
  const timeRef = useRef(0);
  const noise2DRef = useRef(createNoise2D());

  const updateWind = useCallback((delta: number) => {
    timeRef.current += delta * mergedConfig.timeScale;
    const t = timeRef.current;

    const windX = noise2DRef.current(t * mergedConfig.noiseScale, 0) * mergedConfig.maxForce;
    const windZ = noise2DRef.current(0, t * mergedConfig.noiseScale + 100) * mergedConfig.maxForce;
    const windY = noise2DRef.current(t * mergedConfig.noiseScale * 0.5, 50) * mergedConfig.maxForce * 0.3;

    windForceRef.current.set(windX, windY, windZ);
    return windForceRef.current;
  }, [mergedConfig]);

  return { windForceRef, updateWind };
}
