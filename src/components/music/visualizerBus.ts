/**
 * 空白地帯 - visualizerBus（記憶の粒の共有バス）
 *
 * エンジン/フックが書き、Canvas（rAF）が読む、Reactを介さない可変シングルトン。
 * 既存の --music-energy CSS変数方式の思想（再レンダーゼロ）を、
 * Canvasビジュアライザーに必要な豊かさ（帯域・状態・出来事・視点）へ拡張する。
 *
 * 書き手と読み手の規約：
 * - 書き手：useEnsemble（250ms tick・再生状態・帯域）、EnsembleEngine（echo滲出）、
 *   HistoryGraph（React Flowのviewport）
 * - 読み手：MemoryCanvas のrAFループのみ。読み手は書かない
 * - Reactのstate/contextには決して載せない（毎フレームの変化で再レンダーが起きるため）
 */

import type { MusicState, StemRole } from '@/types';

/** React Flowの視点（world→screen変換）。onInit/onMoveで更新される */
export interface VisualizerViewport {
  x: number;
  y: number;
  zoom: number;
}

/** echo滲出の出来事（残像の暈のトリガー。読み手は at からの経過で減衰させる） */
export interface EchoFlash {
  /** performance.now() */
  at: number;
  /** 滲んだ層 */
  roles: StemRole[];
  /** 風化係数（0.15-0.5）。古い記憶ほど淡い残像になる */
  weathering: number;
}

/** 欠落の一瞬（silence burst）の予定。斑の広がりのトリガー */
export interface SilenceBurstEvent {
  /** バーストが始まるperformance.now()（エンジンが予定時刻で発行する） */
  at: number;
  /** バーストの長さ（秒） */
  durationSec: number;
}

interface VisualizerState {
  /** 再生中か。falseの間、Canvasはフェードアウト→rAF停止 */
  playing: boolean;
  /** 平滑化済みの全体音量 0-1 */
  level: number;
  /** 低域（〜750Hz）0-1 — 全体のゆっくりした呼吸へ */
  low: number;
  /** 中域（750Hz〜4kHz）0-1 — 粒の明度へ */
  mid: number;
  /** 高域（4kHz〜）0-1 — ごく小さな煌めきへ */
  high: number;
  /** manifestのMusicState（density/trend/absence/stillness） */
  musicState: MusicState | null;
  /** React Flowの視点 */
  viewport: VisualizerViewport;
  /** 直近のecho滲出（nullなら残像なし） */
  echoFlash: EchoFlash | null;
  /** 直近の欠落の一瞬（nullなら斑は定常のまま） */
  silenceBurst: SilenceBurstEvent | null;
  /**
   * 音の時間領域波形（128サンプル・128が無音の中心線）。
   * 波形線の形そのものになる。割り当てを避けるため配列は使い回し。
   * 型はUint8Array<ArrayBuffer>：AnalyserNodeのAPIがSharedArrayBuffer裏付けの
   * 配列を受け付けないため（TS 5.7+のジェネリック型付き配列）
   */
  waveform: Uint8Array<ArrayBuffer>;
  /** 大変容の瞬間（斑の深化・輪郭出現などの出来事トリガー） */
  majorEvent: { at: number } | null;
  /** 直近フレームのCanvas処理時間ms（性能予算8msの監視用。書き手はMemoryCanvas） */
  frameMs: number;
}

/** 共有バスの実体。直接フィールドを読み書きする（意図的にプレーン） */
export const visualizerBus: VisualizerState = {
  playing: false,
  level: 0,
  low: 0,
  mid: 0,
  high: 0,
  musicState: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  echoFlash: null,
  silenceBurst: null,
  waveform: new Uint8Array(128).fill(128),
  majorEvent: null,
  frameMs: 0,
};

/** 停止時のリセット（フェードアウト用にviewportとmusicStateは残す） */
export function resetVisualizerBus(): void {
  visualizerBus.playing = false;
  visualizerBus.level = 0;
  visualizerBus.low = 0;
  visualizerBus.mid = 0;
  visualizerBus.high = 0;
  visualizerBus.echoFlash = null;
  visualizerBus.silenceBurst = null;
  visualizerBus.waveform.fill(128); // 中心線＝無音
  visualizerBus.majorEvent = null;
  visualizerBus.frameMs = 0;
}

// 開発時のみ：CDP/コンソールから出来事を注入して視覚検証できるフック。
// 本番バンドルには露出しない
if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__kuuhakuVisualizerBus = visualizerBus;
}

// ============================================
// 帯域分割（純粋関数）
// ============================================

/**
 * AnalyserNodeの周波数データ（fftSize=256 → 128bin、48kHz出力なら
 * 1bin≈187.5Hz）を3帯域の平均に割る。
 *   low  : bin 0-3   （〜750Hz）    …地鳴り・低音の記憶
 *   mid  : bin 4-21  （〜4kHz）     …旋律・律動の実体
 *   high : bin 22〜  （4kHz〜）     …空気の擦れ・煌めき
 * すべて0-1。levelは全binの平均（従来のreadEnergyと同じ定義）。
 */
export function splitBands(
  frequencyData: Uint8Array,
): { level: number; low: number; mid: number; high: number } {
  const n = frequencyData.length;
  if (n === 0) return { level: 0, low: 0, mid: 0, high: 0 };

  const LOW_END = Math.min(4, n);
  const MID_END = Math.min(22, n);

  let sumAll = 0;
  let sumLow = 0;
  let sumMid = 0;
  let sumHigh = 0;
  for (let i = 0; i < n; i++) {
    const v = frequencyData[i];
    sumAll += v;
    if (i < LOW_END) sumLow += v;
    else if (i < MID_END) sumMid += v;
    else sumHigh += v;
  }
  const highCount = Math.max(1, n - MID_END);
  return {
    level: sumAll / (n * 255),
    low: sumLow / (LOW_END * 255),
    mid: sumMid / (Math.max(1, MID_END - LOW_END) * 255) * 1.15,
    high: sumHigh / (highCount * 255) * 1.1,
  };
}
