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
import type { PerformanceIntent } from './ensembleRules';
import { visualizerBus, resetVisualizerBus } from './visualizerBus';

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
/**
 * 帯域・波形のtick間隔。周波数への「リアルタイム」な反応のため50ms（20Hz）。
 * getByteFrequencyData/TimeDomainDataは軽量で、Canvas側はさらに
 * フレーム単位の易しみで滑らかにするため、コスト・見た目とも問題ない
 */
const ENERGY_TICK_MS = 50;

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

export function useEnsemble(): {
  status: EnsembleStatus;
  toggle: () => void;
  /** 聴き手の演奏意図を空間へ渡す（nullで手放す＝空間の記憶のままへ戻る） */
  setIntent: (intent: PerformanceIntent | null) => void;
  /** 聴き手の音量（0-2、1が等倍）。ビジュアルには影響しない */
  setVolume: (volume: number) => void;
} {
  const [status, setStatus] = useState<EnsembleStatus>('idle');
  const engineRef = useRef<EnsembleEngine | null>(null);
  /** 再生前にスライダーが動いた場合も、開始時にその意図から鳴り始めるよう保持 */
  const intentRef = useRef<PerformanceIntent | null>(null);
  /** 再生前に音量が動いた場合も、開始時にその音量で鳴り始めるよう保持 */
  const volumeRef = useRef(1);
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
    // Canvas側はplaying=falseを見てフェードアウト→rAF停止する
    resetVisualizerBus();
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
      // 再生前に動かされたスライダー（傾き・音量）を開始時点から反映する
      engine.setIntent(intentRef.current);
      engine.setListenerVolume(volumeRef.current);

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
          // 再生前に置かれていた意図があれば、その傾きから鳴り始める
          engine.setIntent(intentRef.current);
          await engine.start(manifest);
        } catch {
          engineRef.current = null;
          setStatus('error');
          return;
        }
        if (engineRef.current !== engine) return;

        generatedAtRef.current = manifest.generatedAt;
        setStatus('playing');
        visualizerBus.playing = true;
        visualizerBus.musicState = manifest.musicState;

        // エネルギー → CSS変数（既存の呼吸）＋ visualizerBus（Canvasの粒・波形線）
        energyTimerRef.current = setInterval(function energyTick() {
          const spectrum = engine.readSpectrum();
          writeEnergyVar(spectrum.level);
          visualizerBus.level = spectrum.level;
          visualizerBus.low = spectrum.low;
          visualizerBus.mid = spectrum.mid;
          visualizerBus.high = spectrum.high;
          // 時間領域波形（バスの配列へ直接書き込み＝割り当てなし）
          engine.readWaveform(visualizerBus.waveform);
        }, ENERGY_TICK_MS);

        // manifestの静かな見張り：新しい採取があればクロスフェード
        pollTimerRef.current = setInterval(function pollTick() {
          void (async function checkManifest() {
            const next = await fetchManifest();
            if (!next || engineRef.current !== engine) return;
            if (next.generatedAt && next.generatedAt !== generatedAtRef.current) {
              generatedAtRef.current = next.generatedAt;
              await engine.refresh(next);
              // 新しい採取のMusicStateをCanvasにも伝える
              visualizerBus.musicState = next.musicState;
            }
          })();
        }, MANIFEST_POLL_MS);
      })();
    },
    [teardown],
  );

  /** スライダー等の意図を保持し、再生中ならエンジンへ即（4秒ランプで）伝える */
  const setIntent = useCallback(function setEnsembleIntent(
    intent: PerformanceIntent | null,
  ) {
    intentRef.current = intent;
    engineRef.current?.setIntent(intent);
  }, []);

  /** 聴き手の音量。停止中も保持し、次の再生開始時に反映される */
  const setVolume = useCallback(function setEnsembleVolume(volume: number) {
    volumeRef.current = volume;
    engineRef.current?.setListenerVolume(volume);
  }, []);

  // ページを離れる時は必ず沈黙する（リーク防止：AudioContext・タイマーを残さない）
  useEffect(function bindUnmountCleanup() {
    return teardown;
  }, [teardown]);

  return { status, toggle, setIntent, setVolume };
}
