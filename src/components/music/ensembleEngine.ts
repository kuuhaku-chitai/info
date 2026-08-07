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

import type { MusicState, StemManifest, GenerationStems, StemRole } from '@/types';
import {
  buildMixPlan,
  echoSurfaceGain,
  echoProbabilityMultiplier,
  masterLowpassHz,
  isMajorTransformation,
  BREATH_CYCLE_SEC,
  type MixPlan,
  type PerformanceIntent,
} from './ensembleRules';
import {
  buildChapterPlan,
  decideEchoSurfacing,
  CHAPTER_CYCLE_SEC,
  type EchoPlan,
} from './chapterRules';
import { visualizerBus, splitBands } from './visualizerBus';

/**
 * 聴き手がスライダーを動かした時のランプ秒数。
 * 通常の呼吸（10-16秒）より速く応答するが、それでも4秒——
 * 楽器のような即時性ではなく、空間が聴き手に「ゆっくり応える」速さ。
 */
const INTENT_RAMP_SEC = 4;

/** 章の入れ替わり（記憶の地層の交代）のクロスフェード秒数 */
const CHAPTER_CROSSFADE_SEC = 12;

/** 大変容時のfilter sweep：一度閉じてから8秒かけて開く（出来事は必ず減衰して戻る） */
const SWEEP_CLOSE_HZ = 1200;
const SWEEP_OPEN_SEC = 8;

/** 大変容時のecho boost（1呼吸周期のみ。実効風化は1未満にclampされる） */
const ECHO_BOOST = 1.5;

/**
 * デバイスメモリによるecho声部の上限（メモリ安全性の第一防衛線）。
 * デコード後1 stem≈18.4MB（float32）のため：
 *   ≤2GB → 0本（記憶の地層を無効化。現行動作と同一＝安全）
 *   ≤4GB → 1本（常駐≈92MB）
 *   それ以外/API非対応 → 2本（承認済み既定値・常駐≈111MB）
 */
function readEchoVoiceBudget(): number {
  const memory = (navigator as { deviceMemory?: number }).deviceMemory;
  if (typeof memory !== 'number') return 2;
  if (memory <= 2) return 0;
  if (memory <= 4) return 1;
  return 2;
}

/** 1 stem分の再生ノード束 */
interface StemVoice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfoOsc: OscillatorNode;
  lfoDepth: GainNode;
}

/**
 * 記憶の声部（echo）：過去世代のstem 1本分。
 *   BufferSource(loop) → BiquadFilter(lowpass=風化のこもり) → gain → master
 * LFOは持たない——風化した記憶は自ら揺れない。揺れるのは現在だけ。
 */
interface EchoVoice {
  role: StemRole;
  generationId: string;
  source: AudioBufferSourceNode;
  filter: BiquadFilterNode;
  gain: GainNode;
}

/** ゲイン変化の時定数（秒）。ランプ秒数の約1/3で自然な指数カーブになる */
function rampTimeConstant(rampSec: number): number {
  return Math.max(0.5, rampSec / 3);
}

export class EnsembleEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  /** master直後の常設lowpass。普段は20kHz＝素通し。stillness/absenceでこもる */
  private masterFilter: BiquadFilterNode | null = null;
  /**
   * 聴き手の音量（analyserの後段）。0-2、1が等倍。
   * ビジュアライザーはanalyserから読むため、音量を絞っても粒は生きたまま——
   * 音を小さくしても空間の記憶の姿は変わらない
   */
  private listenerGain: GainNode | null = null;
  /** start前に設定された音量を保持し、グラフ構築時に適用する */
  private listenerVolume = 1;
  private analyser: AnalyserNode | null = null;
  /** 大変容のecho boostが残っている呼吸周期数（0=通常） */
  private echoBoostCycles = 0;
  private voices: StemVoice[] = [];
  private cycleTimer: ReturnType<typeof setInterval> | null = null;
  private cycleIndex = 0;
  /** 現在鳴っている計画の周期番号（intent変更時に同じ計画を傾け直すため） */
  private lastPlanIndex = 0;
  /** 聴き手の演奏意図。nullなら空間の記憶のまま */
  private intent: PerformanceIntent | null = null;
  private musicState: MusicState | null = null;

  // --- 記憶の地層（echo） ---
  private chapterTimer: ReturnType<typeof setInterval> | null = null;
  private chapterIndex = 0;
  private chapterPlan: EchoPlan | null = null;
  private echoVoices: EchoVoice[] = [];
  /** manifestに載っていた全世代（現行含む） */
  private generations: GenerationStems[] = [];
  private currentGenerationId: string | null = null;
  /** デバイスメモリ由来のecho上限（0なら地層は無効） */
  private readonly echoVoiceBudget = readEchoVoiceBudget();
  /** 章の読み込み中フラグ（デコードが章間隔を跨いだ時の二重実行防止） */
  private chapterLoading = false;
  private currentMasterTarget = 0;
  /** エネルギー読み取り用の再利用バッファ（毎フレームの確保を避ける） */
  private freqData: Uint8Array<ArrayBuffer> | null = null;
  private smoothedEnergy = 0;

  /** 再生中か（開始済み・停止前） */
  get isPlaying(): boolean {
    return this.ctx !== null;
  }

  /**
   * 聴き手の音量（0-2、1が等倍）。0.1秒の短いランプ＝スライダーに素直に応える
   * （演奏の傾きと違い、音量は「聴く環境の調整」なので即応性を優先する）
   */
  setListenerVolume(volume: number): void {
    // 上限3：パネルのスライダー範囲（0-3）に合わせる。過大入力はリミッターが守る
    const clamped = Math.min(3, Math.max(0, volume));
    this.listenerVolume = clamped;
    if (this.ctx && this.listenerGain) {
      this.listenerGain.gain.setTargetAtTime(clamped, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * manifestのstemsを取得・デコードして再生を開始する。
   * 必ずユーザー操作（クリック）から呼ぶこと——ブラウザの自動再生制約に従う。
   */
  async start(manifest: StemManifest): Promise<void> {
    if (this.ctx || manifest.stems.length === 0) return;
    this.musicState = manifest.musicState;
    // 記憶の地層：manifestの世代一覧を保持（古いキャッシュ由来でも安全に既定値へ）
    this.generations = manifest.generations ?? [];
    this.currentGenerationId = manifest.stems[0]?.generationId ?? null;

    const ctx = new AudioContext();
    this.ctx = ctx;

    // 出力側から組む：master → lowpass → analyser → destination
    // lowpassは普段20kHz＝完全に素通し。stillness/absenceの深さと
    // 大変容のsweepだけが、この一箇所を通して「こもり」を作る
    const master = ctx.createGain();
    master.gain.value = 0; // 無音から立ち上がる（突然音が出る驚きを作らない）
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 20000;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.9;
    master.connect(filter);
    filter.connect(analyser);
    // 聴き手の音量段はanalyserの後：音量を変えてもビジュアルの読みは不変。
    // 音量>1の増幅でも割れないよう、最後に緩やかなリミッター
    // （閾値-10dB・普段は素通しで色付けしない）を挟む
    const listener = ctx.createGain();
    listener.gain.value = this.listenerVolume;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 20;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.005;
    limiter.release.value = 0.25;
    analyser.connect(listener);
    listener.connect(limiter);
    limiter.connect(ctx.destination);
    this.listenerGain = listener;
    this.masterGain = master;
    this.masterFilter = filter;
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

    // 記憶の地層：最初の章をすぐ立て、以後は5分ごと（budget=0なら完全休眠）
    if (this.echoVoiceBudget > 0) {
      void this.runChapter();
      this.chapterTimer = setInterval(
        this.onChapterCycle.bind(this),
        CHAPTER_CYCLE_SEC * 1000,
      );
    }
  }

  /**
   * manifestが新しくなった時の差し替え（クロスフェード）。
   * 旧stemはゆっくり沈み、新stemがゆっくり立ち上がる——音は途切れない。
   */
  async refresh(manifest: StemManifest): Promise<void> {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || manifest.stems.length === 0) return;
    // 大変容の判定はmusicStateを差し替える「前」に（前回との比較だから）
    const majorTransformation = isMajorTransformation(
      this.musicState,
      manifest.musicState,
    );
    this.musicState = manifest.musicState;
    // 記憶の地層も更新（現行だった世代は次の章から「過去」として浮かべる）
    this.generations = manifest.generations ?? [];
    this.currentGenerationId = manifest.stems[0]?.generationId ?? null;

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

    // 大変容（出来事）：一度こもってから8秒かけて開くsweep＋この呼吸周期だけecho boost。
    // どちらも必ず減衰して微弱へ戻る。
    // boostは2で置き、直後のnextPlan()が1つ消費して「今の周期」に効き、
    // 次の呼吸のnextPlan()で0になる＝ちょうど1呼吸周期
    if (majorTransformation && this.masterFilter) {
      const now = ctx.currentTime;
      const openTarget = masterLowpassHz(manifest.musicState);
      this.masterFilter.frequency.setTargetAtTime(SWEEP_CLOSE_HZ, now, 0.2);
      this.masterFilter.frequency.setTargetAtTime(
        openTarget,
        now + 0.8,
        SWEEP_OPEN_SEC / 3,
      );
      this.echoBoostCycles = 2;
      // 大変容の瞬間をビジュアライザーへ（斑の深化・輪郭出現のトリガー）
      visualizerBus.majorEvent = { at: performance.now() };
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
   * 現在の音のスペクトラム（0-1）。levelは平滑化済み（従来のreadEnergyと同義）、
   * low/mid/highは帯域別の生値（Canvas側が用途別に減衰させる）。
   * ビジュアライザーはこの値を「微弱に」使う（振幅の上限は使う側で絞る）
   */
  readSpectrum(): { level: number; low: number; mid: number; high: number } {
    const analyser = this.analyser;
    const data = this.freqData;
    if (!analyser || !data) return { level: 0, low: 0, mid: 0, high: 0 };
    analyser.getByteFrequencyData(data);
    const bands = splitBands(data);
    // levelはさらに平滑化：呼吸のような遅い揺れだけを通す
    this.smoothedEnergy = this.smoothedEnergy * 0.92 + bands.level * 0.08;
    return { ...bands, level: this.smoothedEnergy };
  }

  /**
   * 音の時間領域波形を渡された配列へ書き込む（波形線の形そのもの）。
   * 配列は呼び出し側（visualizerBus）が使い回す＝tick毎の割り当てなし
   */
  readWaveform(target: Uint8Array<ArrayBuffer>): void {
    if (!this.analyser) {
      target.fill(128); // 中心線＝無音
      return;
    }
    this.analyser.getByteTimeDomainData(target);
  }

  /** すべてのリソースを即時解放する（unmount時の最終手段でも安全） */
  dispose(): void {
    if (this.cycleTimer !== null) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
    if (this.chapterTimer !== null) {
      clearInterval(this.chapterTimer);
      this.chapterTimer = null;
    }
    this.disposeEchoVoices(this.echoVoices);
    this.echoVoices = [];
    this.chapterPlan = null;
    this.disposeVoices(this.voices);
    this.voices = [];
    const ctx = this.ctx;
    this.ctx = null;
    this.masterGain = null;
    if (this.masterFilter) {
      this.masterFilter.disconnect();
      this.masterFilter = null;
    }
    if (this.listenerGain) {
      this.listenerGain.disconnect();
      this.listenerGain = null;
    }
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
    // echo boostの消費：大変容時に2で置かれ、その周期で1、次の呼吸で0になる
    // ＝ちょうど1呼吸周期だけ効く（setIntentの再適用はnextPlanを通らないため安定）
    if (this.echoBoostCycles > 0) {
      this.echoBoostCycles -= 1;
    }
    this.lastPlanIndex = this.cycleIndex;
    const plan = buildMixPlan(
      this.musicState,
      new Date().getHours(),
      this.cycleIndex,
      this.intent,
    );
    this.cycleIndex += 1;
    return plan;
  }

  /**
   * 聴き手の演奏意図を更新する。
   *
   * 再生中なら「いま鳴っている周期の計画」を同じ乱数種で立て直し、
   * 新しい傾きだけを4秒ランプで反映する——スライダーに空間が
   * ゆっくり応える。silenceBurstは再スケジュールしない
   * （同じ周期で欠落の一瞬が二重に予約されるのを防ぐ）。
   * 次の呼吸周期からは通常の流れ（nextPlan）が意図を引き継ぐ。
   */
  setIntent(intent: PerformanceIntent | null): void {
    this.intent = intent;
    if (!this.ctx) return;
    const replan = buildMixPlan(
      this.musicState,
      new Date().getHours(),
      this.lastPlanIndex,
      intent,
    );
    // publishEvents=false：スライダー操作は音（echo voiceのゲイン）には効くが、
    // ビジュアルの出来事（echoFlash＝輪郭・暈・斑のトリガー）は発行しない。
    // これをtrueのままにすると、スライダーを動かすたびに毎回echoFlashが
    // 新しいタイムスタンプで再発行され、Canvasが「新しい滲出」と誤検知して
    // 輪郭が湧き続ける（＝操作タイミングに視覚が張り付く不具合）
    this.applyPlan({ ...replan, silenceBurst: null, rampSec: INTENT_RAMP_SEC }, false);
  }

  /**
   * 計画を音声グラフへ反映する。すべて指数ランプ＝急な変化は存在しない。
   * publishEvents：ビジュアライザーへ出来事（echoFlash）を発行してよいか。
   * 呼吸周期・差し替えはtrue、setIntentの再適用はfalse（音だけ更新）。
   */
  private applyPlan(plan: MixPlan, publishEvents = true): void {
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

    // こもり（状態の層）：stillness/absenceの深さがカットオフを決める。
    // 普段は20kHz＝素通しで、フィルタの存在自体が聴こえない
    if (this.masterFilter) {
      this.masterFilter.frequency.setTargetAtTime(
        masterLowpassHz(this.musicState),
        now,
        tc,
      );
    }

    // 欠落の一瞬：計画された時刻に全体が息を呑み、ゆっくり戻る
    if (plan.silenceBurst) {
      const at = now + plan.silenceBurst.delaySec;
      master.gain.setTargetAtTime(0.02, at, 0.4);
      master.gain.setTargetAtTime(
        this.currentMasterTarget,
        at + plan.silenceBurst.durationSec,
        2.5, // 戻りは沈むより遅く——欠落の余韻
      );
      // 斑の広がり（Canvas）にも同じ予定時刻を伝える——音と視覚が同じ息を呑む
      visualizerBus.silenceBurst = {
        at: performance.now() + plan.silenceBurst.delaySec * 1000,
        durationSec: plan.silenceBurst.durationSec,
      };
    }

    // 記憶の滲出：現在の計画で休んでいる層に、章が選んだ過去の声を重ねるか判定
    this.applyEchoTargets(plan, tc, publishEvents);
  }

  // ============================================
  // 記憶の地層（echo）
  // ============================================

  /** 過去世代の一覧（現行世代とstems欠損世代を除く） */
  private pastGenerations(): GenerationStems[] {
    return this.generations.filter(
      function isPast(this: EnsembleEngine, g: GenerationStems) {
        return g.id !== this.currentGenerationId && g.stems.length > 0;
      }.bind(this),
    );
  }

  /** 章タイマーのハンドラ（setIntervalへbindで登録） */
  private onChapterCycle(): void {
    void this.runChapter();
  }

  /**
   * 1章分の入れ替え：計画 → 必要stemの取得・デコード（1本ずつ順次）→
   * 旧echoの12秒フェードアウト → 新echoを無音で待機させる。
   * 実際に鳴るのは次の呼吸周期の滲出判定から——章の変わり目も静か。
   */
  private async runChapter(): Promise<void> {
    const ctx = this.ctx;
    const master = this.masterGain;
    if (!ctx || !master || this.chapterLoading) return;
    this.chapterLoading = true;

    try {
      const index = this.chapterIndex;
      this.chapterIndex += 1;
      const plan = buildChapterPlan(this.pastGenerations(), new Date(), index);

      // 同じ世代が続く章なら声部を作り直さない（無駄なfetch/decodeをしない）
      const sameGeneration =
        plan.generationId !== null &&
        plan.generationId === this.chapterPlan?.generationId &&
        this.echoVoices.length > 0;
      this.chapterPlan = plan;
      if (sameGeneration) return;

      // --- 新しい記憶の声部を用意（budget内・1本ずつ順次デコード） ---
      const newVoices: EchoVoice[] = [];
      if (plan.generationId !== null) {
        const generation = this.generations.find(function matchId(g) {
          return g.id === plan.generationId;
        });
        const roles = plan.roles.slice(0, this.echoVoiceBudget);
        for (const role of roles) {
          const stem = generation?.stems.find(function matchRole(s) {
            return s.stemRole === role;
          });
          if (!stem) continue;
          const buffer = await this.fetchAndDecode(ctx, stem);
          // デコード待ちの間に停止された場合は静かに退く
          if (!this.ctx) {
            this.disposeEchoVoices(newVoices);
            return;
          }
          // 取得失敗は沈黙にフォールバック（欠けたままも空白）
          if (!buffer) continue;
          newVoices.push(
            this.createEchoVoice(ctx, master, buffer, role, plan),
          );
        }
      }

      // --- 交代：旧世代はゆっくり沈み、後から解体 ---
      const oldVoices = this.echoVoices;
      const now = ctx.currentTime;
      for (const voice of oldVoices) {
        voice.gain.gain.setTargetAtTime(
          0,
          now,
          rampTimeConstant(CHAPTER_CROSSFADE_SEC),
        );
      }
      if (oldVoices.length > 0) {
        setTimeout(
          this.disposeEchoVoices.bind(this, oldVoices),
          CHAPTER_CROSSFADE_SEC * 2500,
        );
      }
      this.echoVoices = newVoices;
    } finally {
      this.chapterLoading = false;
    }
  }

  /** 記憶の声部1本を組み立てる（ゲイン0＝無音で待機。ループ開始位置はランダム） */
  private createEchoVoice(
    ctx: AudioContext,
    master: GainNode,
    buffer: AudioBuffer,
    role: StemRole,
    plan: EchoPlan,
  ): EchoVoice {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // 風化のこもり：老いた記憶ほどカットオフが低い
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = plan.lowpassHz;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(0, Math.random() * buffer.duration);

    return { role, generationId: plan.generationId ?? '', source, filter, gain };
  }

  /**
   * 呼吸周期ごとの滲出：休んでいる層 × 章の層 × 確率の交差だけが現れる。
   * 判定は純粋関数（decideEchoSurfacing、周期番号で決定的）なので、
   * intent変更時の再適用でも同じ周期なら同じ判定になる。
   */
  private applyEchoTargets(
    plan: MixPlan,
    timeConstant: number,
    publishFlash: boolean,
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.chapterPlan || this.echoVoices.length === 0) return;

    const restingRoles = plan.targets
      .filter(function isResting(t) { return t.resting; })
      .map(function pickRole(t) { return t.role; });
    // 「間」は記憶にも効く：深い間は滲出確率も下げる（間はすべての音への負の空間）
    const surfaced = decideEchoSurfacing(
      this.chapterPlan,
      restingRoles,
      this.lastPlanIndex,
      echoProbabilityMultiplier(this.intent),
    );

    const now = ctx.currentTime;
    // 大変容の呼吸だけ記憶がわずかに前へ出る（実効風化は1未満にclamp済み）
    const boost = this.echoBoostCycles > 0 ? ECHO_BOOST : 1;
    for (const voice of this.echoVoices) {
      const target = surfaced.includes(voice.role)
        ? echoSurfaceGain(voice.role, this.chapterPlan.gainMul, this.intent, boost)
        : 0;
      voice.gain.gain.setTargetAtTime(target, now, timeConstant);
    }

    // 記憶が実際に滲んだ瞬間をビジュアライザーへ（残像の暈・輪郭のトリガー）。
    // publishFlash=falseのsetIntent経路では発行しない＝スライダー操作では
    // 視覚の出来事が湧かない。風化係数を添える——古い記憶ほど淡い残像として描かれる
    if (publishFlash && surfaced.length > 0) {
      visualizerBus.echoFlash = {
        at: performance.now(),
        roles: surfaced,
        weathering: this.chapterPlan.gainMul,
      };
    }
  }

  /** 記憶の声部の解体（bind用に配列を引数で受ける） */
  private disposeEchoVoices(voices: EchoVoice[]): void {
    for (const voice of voices) {
      try {
        voice.source.stop();
      } catch {
        // 既に停止済みなら何もしない
      }
      voice.source.disconnect();
      voice.filter.disconnect();
      voice.gain.disconnect();
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
