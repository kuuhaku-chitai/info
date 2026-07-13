/**
 * 空白地帯 - アンサンブル・エンジン（Web Audio API / AI不使用）
 *
 * R2のstemをループ再生し、ensembleRulesの計画に従って重ね直す。
 * Reactに依存しないクラスとして実装し、useEnsembleフックが寿命を管理する。
 *
 * 音声グラフ：
 *   stem(BufferSource, loop) → stemGain ─┐
 *                     LFO(Osc→depthGain) ┘（gainへ微弱な揺らぎを加算）
 *   … ×4 → masterGain → AnalyserNode → destination
 *
 * シームレス継続の担保：
 * - ループ開始位置は毎回ランダム＝同じ「曲」は二度と始まらない
 * - すべてのゲイン変更は setTargetAtTime（指数ランプ）。クリックノイズも
 *   急峻な変化も物理的に発生しない
 * - manifest更新時は新旧のstemGainをクロスフェード。音は一瞬も止まらない
 *
 * メモリリーク防止（CLAUDE.mdルール準拠）：
 * - コールバックはすべて名前付きメソッドを .bind で登録
 * - dispose()がタイマー・ノード・AudioContextを必ず解放する
 */

import type { MusicState, StemManifest } from '@/types';
import { buildMixPlan, BREATH_CYCLE_SEC, type MixPlan } from './ensembleRules';

/** 1 stem分の再生ノード束 */
interface StemVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfoOsc: OscillatorNode;
  lfoDepth: GainNode;
}

/** ゲイン変化の時定数（秒）。ランプ秒数の約1/3で自然な指数カーブになる */
function rampTimeConstant(rampSec: number): number {
  return Math.max(0.5, rampSec / 3);
}

export class EnsembleEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voices: StemVoice[] = [];
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private cycleIndex = 0;
  private musicState: MusicState | null = null;
  private currentMasterTarget = 0;
  /** エネルギー読み取り用の再利用バッファ（毎フレームの確保を避ける） */
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private smoothedEnergy = 0;

  /** 再生中か（開始済み・停止前） */
  get isPlaying(): boolean {
    return this.ctx !== null;
  }

  /**
   * manifestのstemsを取得・デコードして再生を開始する。
   * 必ずユーザー操作（クリック）から呼ぶこと——ブラウザの自動再生制約に従う。
   */
  async start(manifest: StemManifest): Promise<void> {
    if (this.ctx || manifest.stems.length === 0) return;
    this.musicState = manifest.musicState;

    const ctx = new AudioContext();
    this.ctx = ctx;

    // 出力側から組む：master → analyser → destination
    const master = ctx.createGain();
    master.gain.value = 0; // 無音から立ち上がる（突然音が出る驚きを作らない）
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.9;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    this.masterGain = master;
    this.analyser = analyser;
    this.freqData = new Uint8Array(analyser.frequencyBinCount);

    // stemsを並列で取得・デコード
    const buffers = await Promise.all(
      manifest.stems.map(this.fetchAndDecode.bind(this, ctx)),
    );
    if (!this.ctx) return; // ロード中にstop()された場合は静かに退く

    for (let i = 0; i < manifest.stems.length; i++) {
      const buffer = buffers[i];
      if (!buffer) continue;
      this.voices.push(this.createVoice(ctx, master, buffer));
    }

    // 最初の計画を適用し、以後は呼吸周期ごとに立て直す
    this.applyPlan(this.nextPlan());
    this.cycleTimer = setInterval(
      this.onBreathCycle.bind(this),
      BREATH_CYCLE_SEC * 1000,
    );
  }

  /**
   * manifestが新しくなった時の差し替え（クロスフェード）。
   * 旧stemはゆっくり沈み、新stemがゆっくり立ち上がる——音は途切れない。
   */
  async refresh(manifest: StemManifest): Promise<void> {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || manifest.stems.length === 0) return;
    this.musicState = manifest.musicState;

    const CROSSFADE_SEC = 12;
    const oldVoices = this.voices;

    const buffers = await Promise.all(
      manifest.stems.map(this.fetchAndDecode.bind(this, ctx)),
    );
    if (!this.ctx) return;

    // 新世代を無音で並べ、旧世代を沈め、新しい計画でゆっくり立ち上げる
    this.voices = [];
    for (let i = 0; i < manifest.stems.length; i++) {
      const buffer = buffers[i];
      if (!buffer) continue;
      this.voices.push(this.createVoice(ctx, master, buffer));
    }
    for (const voice of oldVoices) {
      voice.gain.gain.setTargetAtTime(0, ctx.currentTime, rampTimeConstant(CROSSFADE_SEC));
    }
    this.applyPlan(this.nextPlan());

    // 旧世代はフェードが十分沈んでから解体する
    setTimeout(this.disposeVoices.bind(this, oldVoices), CROSSFADE_SEC * 2500);
  }

  /** ゆっくり沈黙してから完全に解放する */
  stop(): void {
    const ctx = this.ctx;
    if (ctx && this.masterGain) {
      this.masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    }
    // 沈黙の余韻（約2秒）を待ってから解体
    setTimeout(this.dispose.bind(this), 2000);
  }

  /**
   * 現在の音のエネルギー（0-1、平滑化済み）。
   * ビジュアライザーはこの値を「微弱に」使う（振幅の上限は使う側で絞る）
   */
  readEnergy(): number {
    const analyser = this.analyser;
    const data = this.freqData;
    if (!analyser || !data) return 0;
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) sum += data[i];
    const raw = sum / (data.length * 255);
    // さらに平滑化：呼吸のような遅い揺れだけを通す
    this.smoothedEnergy = this.smoothedEnergy * 0.92 + raw * 0.08;
    return this.smoothedEnergy;
  }

  /** すべてのリソースを即時解放する（unmount時の最終手段でも安全） */
  dispose(): void {
    if (this.cycleTimer !== null) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    this.disposeVoices(this.voices);
    this.voices = [];
    const ctx = this.ctx;
    this.ctx = null;
    this.masterGain = null;
    this.analyser = null;
    this.freqData = null;
    if (ctx && ctx.state !== 'closed') {
      void ctx.close();
    }
  }

  // ============================================
  // 内部実装
  // ============================================

  private async fetchAndDecode(
    ctx: AudioContext,
    stem: { url: string },
  ): Promise<AudioBuffer | null> {
    try {
      const res = await fetch(stem.url);
      if (!res.ok) return null;
      const bytes = await res.arrayBuffer();
      return await ctx.decodeAudioData(bytes);
    } catch {
      // 1 stemの欠落で全体を止めない。欠けたまま鳴るのも空白地帯らしさ
      return null;
    }
  }

  /** stem 1本分のノード束を組み立てて再生を始める（ゲイン0から） */
  private createVoice(
    ctx: AudioContext,
    master: GainNode,
    buffer: AudioBuffer,
  ): StemVoice {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(master);

    // 音量LFO：sine → depth → gain.gain（加算変調）。周期は後でapplyPlanが設定
    const lfoOsc = ctx.createOscillator();
    lfoOsc.type = 'sine';
    lfoOsc.frequency.value = 1 / 30;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0;
    lfoOsc.connect(lfoDepth);
    lfoDepth.connect(gain.gain);
    lfoOsc.start();

    // ループ開始位置をランダムに：同じ重なりは二度と生まれない
    source.start(0, Math.random() * buffer.duration);
    return { source, gain, lfoOsc, lfoDepth };
  }

  /** 呼吸周期のハンドラ（setIntervalへbindで登録） */
  private onBreathCycle(): void {
    this.applyPlan(this.nextPlan());
  }

  private nextPlan(): MixPlan {
    const plan = buildMixPlan(
      this.musicState,
      new Date().getHours(),
      this.cycleIndex,
    );
    this.cycleIndex += 1;
    return plan;
  }

  /** 計画を音声グラフへ反映する。すべて指数ランプ＝急な変化は存在しない */
  private applyPlan(plan: MixPlan): void {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const tc = rampTimeConstant(plan.rampSec);

    // stemの数はmanifest次第で4未満もありうる。voices[i]とtargetsは採取順で対応
    for (let i = 0; i < this.voices.length && i < plan.targets.length; i++) {
      const voice = this.voices[i];
      const target = plan.targets[i];
      voice.gain.gain.setTargetAtTime(target.gain, now, tc);
      // LFOの深さはゲインを下回らせない（負のゲイン＝位相反転を防ぐ）
      const depth = target.resting ? 0 : Math.min(target.lfo.depth, target.gain * 0.5);
      voice.lfoDepth.gain.setTargetAtTime(depth, now, tc);
      voice.lfoOsc.frequency.setValueAtTime(1 / target.lfo.periodSec, now);
    }

    this.currentMasterTarget = plan.masterGain;
    master.gain.setTargetAtTime(plan.masterGain, now, tc);

    // 欠落の一瞬：計画された時刻に全体が息を呑み、ゆっくり戻る
    if (plan.silenceBurst) {
      const at = now + plan.silenceBurst.delaySec;
      master.gain.setTargetAtTime(0.02, at, 0.4);
      master.gain.setTargetAtTime(
        this.currentMasterTarget,
        at + plan.silenceBurst.durationSec,
        2.5, // 戻りは沈むより遅く——欠落の余韻
      );
    }
  }

  /** 声部の解体（bind用に配列を引数で受ける） */
  private disposeVoices(voices: StemVoice[]): void {
    for (const voice of voices) {
      try {
        voice.source.stop();
        voice.lfoOsc.stop();
      } catch {
        // 既に停止済みなら何もしない
      }
      voice.source.disconnect();
      voice.gain.disconnect();
      voice.lfoOsc.disconnect();
      voice.lfoDepth.disconnect();
    }
  }
}
