'use client';

/**
 * 空白地帯 - useEnsemble（music Modeの寿命管理フック）
 *
 * EnsembleEngine（Web Audio）とmanifest取得を束ね、Reactの世界へ最小限の
 * 状態だけを出す：status と toggle()。音の実体はすべてEngine側にある。
 *
 * ビジュアライザー連動はCSS変数（--music-energy）経由：
 * Reactの再レンダーを一切起こさず、CSSのtransitionだけで
 * 空間全体が微かに呼吸する（派手なエフェクト禁止ルールに最も安全な経路）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { StemManifest } from '@/types';
import { EnsembleEngine } from './ensembleEngine';

export type EnsembleStatus =
  /** 静止（初期状態） */
  | 'idle'
  /** stems取得・デコード中 */
  | 'loading'
  /** 再生中 */
  | 'playing'
  /** まだ一度も採取されていない（音が無いことも空白の状態） */
  | 'empty'
  /** 取得や再生に失敗 */
  | 'error';

/** manifestの再確認間隔。生成は1日3回なので5分で十分すぎるほど新鮮 */
const MANIFEST_POLL_MS = 5 * 60 * 1000;

/** エネルギー → CSS変数の反映間隔。呼吸の速さに60fpsは要らない */
const ENERGY_TICK_MS = 250;

async function fetchManifest(): Promise<StemManifest | null> {
  try {
    const res = await fetch('/api/music/manifest');
    if (!res.ok) return null;
    return (await res.json()) as StemManifest;
  } catch {
    return null;
  }
}

/** CSS変数へエネルギーを書き出す（ビジュアライザーの唯一の入口） */
function writeEnergyVar(value: number): void {
  document.documentElement.style.setProperty('--music-energy', value.toFixed(3));
}

export function useEnsemble(): { status: EnsembleStatus; toggle: () => void } {
  const [status, setStatus] = useState<EnsembleStatus>('idle');
  const engineRef = useRef<EnsembleEngine | null>(null);
  const generatedAtRef = useRef<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const energyTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** タイマー・エンジン・CSS変数のすべてを畳む（名前付きで一箇所に） */
  const teardown = useCallback(function teardownEnsemble() {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (energyTimerRef.current !== null) {
      clearInterval(energyTimerRef.current);
      energyTimerRef.current = null;
    }
    engineRef.current?.stop();
    engineRef.current = null;
    generatedAtRef.current = null;
    writeEnergyVar(0);
  }, []);

  const toggle = useCallback(
    function toggleEnsemble() {
      // 再生中 → 停止（ゆっくり沈黙する。停止すら急がない）
      if (engineRef.current) {
        teardown();
        setStatus('idle');
        return;
      }

      // 停止中 → 開始。AudioContextの生成はこのクリックの同期文脈で行われる
      setStatus('loading');
      const engine = new EnsembleEngine();
      engineRef.current = engine;

      void (async function startEnsemble() {
        const manifest = await fetchManifest();
        if (engineRef.current !== engine) return; // 待機中にトグルされた

        if (!manifest) {
          engineRef.current = null;
          setStatus('error');
          return;
        }
        if (manifest.stems.length === 0) {
          engineRef.current = null;
          setStatus('empty');
          return;
        }

        try {
          await engine.start(manifest);
        } catch {
          engineRef.current = null;
          setStatus('error');
          return;
        }
        if (engineRef.current !== engine) return;

        generatedAtRef.current = manifest.generatedAt;
        setStatus('playing');

        // エネルギー → CSS変数（呼吸の速さで十分）
        energyTimerRef.current = setInterval(function energyTick() {
          writeEnergyVar(engine.readEnergy());
        }, ENERGY_TICK_MS);

        // manifestの静かな見張り：新しい採取があればクロスフェード
        pollTimerRef.current = setInterval(function pollTick() {
          void (async function checkManifest() {
            const next = await fetchManifest();
            if (!next || engineRef.current !== engine) return;
            if (next.generatedAt && next.generatedAt !== generatedAtRef.current) {
              generatedAtRef.current = next.generatedAt;
              await engine.refresh(next);
            }
          })();
        }, MANIFEST_POLL_MS);
      })();
    },
    [teardown],
  );

  // ページを離れる時は必ず沈黙する（リーク防止：AudioContext・タイマーを残さない）
  useEffect(function bindUnmountCleanup() {
    return teardown;
  }, [teardown]);

  return { status, toggle };
}
