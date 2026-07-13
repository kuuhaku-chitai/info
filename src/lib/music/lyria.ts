/**
 * 空白地帯 - Lyria RealTime 生成層
 *
 * 1回のLyriaセッションで「空間の記憶」を4つの擬似stemとして採取する。
 *
 * 擬似stem分離の方法（AI不使用・APIの設定のみ）：
 *   Lyriaは真のstem出力を持たないが、musicGenerationConfigの
 *   muteBass / muteDrums / onlyBassAndDrums を切り替えながらsteerすることで、
 *   ドラムのみ・ベースのみ・旋律のみ・空気感のみの区間を1セッション内で
 *   連続キャプチャできる（restartしない＝生成段階でも音は途切れない）。
 *
 * トランスポートは@google/genaiを使わず、WebSocketを直接叩く：
 *   - SDKのnodeビルドは ws / google-auth-library 経由で https.request を呼び、
 *     Cloudflare Workersのnodejs_compat（unenv）では未実装エラーになる。
 *   - SDKのwebビルドはバイナリフレームをBlob前提でパースするが、
 *     workerdはバイナリフレームをArrayBufferで渡すため、setupComplete以降の
 *     全メッセージが静かに捨てられ「setupComplete待ちタイムアウト」になる。
 *   - 自前実装なら string / ArrayBuffer / Blob の全形式を明示的に扱え、
 *     workerd（本番）・Node 22+（ローカル開発）の両方で確実に動く。
 *   ワイヤーフォーマットはSDK（js-genai v2.11.0）のソースから確認済み。
 *
 * ファイル構成の原則：
 *   前半は純粋関数（パス計画・WAVエンコード）——テスト可能。
 *   後半のcaptureStemsだけがネットワーク副作用を持つ。
 *   DB・R2へは一切触れない（それはgenerate.tsの仕事）。
 */

import type { MusicState, StemPromptPlan, StemRole } from '@/types';

/**
 * 採取の固定順序：骨格（律動・低音）から空気へ向かい、
 * 最も静かな層でセッションを終える。
 */
const CAPTURE_ORDER: readonly StemRole[] = ['rhythm', 'bass', 'melody', 'atmosphere'];

// ============================================
// 定数（音声フォーマットとコスト上限）
// ============================================

/** CLAUDE.md指定のモデルとAPIバージョン */
export const LYRIA_MODEL = 'models/lyria-realtime-exp';
export const LYRIA_API_VERSION = 'v1alpha';

/** Lyria RealTimeのWebSocketエンドポイント（Gemini API） */
const LYRIA_WS_HOST = 'wss://generativelanguage.googleapis.com';

/** Lyria RealTimeの出力フォーマット（48kHz / 16bit / ステレオ PCM） */
const SAMPLE_RATE = 48000;
const CHANNELS = 2;
const BYTES_PER_SAMPLE = 2;
const BYTES_PER_SECOND = SAMPLE_RATE * CHANNELS * BYTES_PER_SAMPLE;

/**
 * 1 stemあたりのキャプチャ秒数。
 * 4 stems × 48秒 ≈ 合計3.2分の音声でセッションを打ち切る＝コスト上限。
 * ブラウザ側はこれをループ・レイヤリングして長時間のアンサンブルにする。
 */
const STEM_CAPTURE_SECONDS = 48;

/**
 * steer後の「馴染み待ち」秒数。設定・プロンプトの切り替えが音に浸透するまでの
 * 過渡区間は捨てる——切り替わりの継ぎ目はstemに残さない。
 */
const SETTLE_SECONDS = 6;

/** 1パスのハードタイムアウト。超えたら失敗として必ずセッションを閉じる */
const PASS_TIMEOUT_MS = 180_000;

/** setupComplete待ちのタイムアウト */
const SETUP_TIMEOUT_MS = 30_000;

// ============================================
// ワイヤー型（SDK非依存の最小定義）
// ============================================

/** musicGenerationConfigのワイヤー形式（camelCaseのままJSONで送る） */
export interface LyriaGenerationConfig {
  /** テンポ。60-200 */
  bpm?: number;
  /** 音の密度。0-1 */
  density?: number;
  /** 明るさ。0-1 */
  brightness?: number;
  /** 生成の分散。0-3 */
  temperature?: number;
  /** プロンプト追従の強さ。高いほど遷移が急峻になる。0-6 */
  guidance?: number;
  /** ベースを黙らせる */
  muteBass?: boolean;
  /** ドラムを黙らせる */
  muteDrums?: boolean;
  /** ベースとドラムのみにする */
  onlyBassAndDrums?: boolean;
}

/** サーバから届くメッセージ（必要なフィールドのみ） */
interface LyriaServerMessage {
  setupComplete?: object;
  serverContent?: {
    audioChunks?: Array<{ data?: string; mimeType?: string }>;
  };
  filteredPrompt?: { text?: string; filteredReason?: string };
}

// ============================================
// 純粋関数：パス計画
// ============================================

/** 1キャプチャ区間（＝1擬似stem）の計画 */
export interface StemPass {
  role: StemRole;
  config: LyriaGenerationConfig;
  prompts: Array<{ text: string; weight: number }>;
}

/** 採取結果 */
export interface CapturedStem {
  role: StemRole;
  wav: Uint8Array;
  durationSec: number;
}

/**
 * MusicStateから全パス共通の生成設定を導く。
 * - bpmは60〜72：trendが最大でも歩くより遅い鼓動。空白地帯に速いテンポは存在しない
 * - densityはLyria側でも低く抑える（プロンプトの形容と二重の防波堤）
 * - brightnessはstillness（静けさ）が深いほど沈む
 * - guidanceは低め＝steer時の遷移を滑らかに（急峻な変化は「派手」になる）
 */
function buildSharedConfig(state: MusicState): LyriaGenerationConfig {
  return {
    bpm: Math.round(60 + 12 * state.trend),
    density: round3(0.1 + 0.3 * state.density * (1 - state.absence * 0.5)),
    brightness: round3(0.15 + 0.35 * (1 - state.stillness)),
    temperature: 1.0,
    guidance: 3.0,
  };
}

/** 小数3桁への丸め（ログの可読性のため） */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * stem役割ごとのmute設定。
 * これがAIを使わない「分離」の正体：APIに用意されたスイッチの組み合わせだけで、
 * 各区間の音色域を絞り込む。
 */
function roleMuteConfig(role: StemRole): Partial<LyriaGenerationConfig> {
  switch (role) {
    case 'rhythm':
      // ドラムのみ（ベースを黙らせる）
      return { onlyBassAndDrums: true, muteBass: true };
    case 'bass':
      // ベースのみ（ドラムを黙らせる）
      return { onlyBassAndDrums: true, muteDrums: true };
    case 'melody':
      // 旋律・和声のみ
      return { muteDrums: true, muteBass: true };
    case 'atmosphere':
      // 空気感のみ。密度・明るさをさらに落とし、最も「空白」に近い層にする
      return { muteDrums: true, muteBass: true };
  }
}

/**
 * プロンプト計画（Memory Engine出力）→ キャプチャパス列。
 *
 * 各パスには「その役割のプロンプト」に加えて、atmosphereのプロンプトを
 * 弱い重み(0.2)で常に敷く。4つのstemは後でブラウザ上で重ねられるため、
 * 全パスが同じ空気を共有していないと、レイヤリングした時に調性が割れる。
 */
export function buildStemPassPlan(
  plans: StemPromptPlan[],
  state: MusicState,
): StemPass[] {
  const shared = buildSharedConfig(state);
  const atmospherePlan = plans.find(isAtmospherePlan);
  const passes: StemPass[] = [];

  for (const role of CAPTURE_ORDER) {
    const plan = plans.find(function matchRole(p) {
      return p.role === role;
    });
    if (!plan) continue;

    const prompts: Array<{ text: string; weight: number }> = [
      { text: plan.text, weight: 1.0 },
    ];
    if (role !== 'atmosphere' && atmospherePlan) {
      prompts.push({ text: atmospherePlan.text, weight: 0.2 });
    }

    const config: LyriaGenerationConfig = {
      ...shared,
      ...roleMuteConfig(role),
    };
    if (role === 'atmosphere') {
      config.density = round3((shared.density ?? 0.1) * 0.6);
      config.brightness = round3((shared.brightness ?? 0.2) * 0.8);
    }

    passes.push({ role, config, prompts });
  }
  return passes;
}

/** atmosphere役割のプラン判定（名前付き述語） */
function isAtmospherePlan(plan: StemPromptPlan): boolean {
  return plan.role === 'atmosphere';
}

// ============================================
// 純粋関数：PCM → WAV
// ============================================

/** base64 → バイト列。Workers（atob）とNode（Buffer）の両方で動く */
export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * 生PCMチャンク列を単一のWAVファイル（RIFF/PCM 16bit）にまとめる。
 * ブラウザのdecodeAudioDataがヘッダから正しいフォーマットを読めるようにする。
 */
export function encodeWavFromPcm(
  chunks: Uint8Array[],
  sampleRate: number = SAMPLE_RATE,
  channels: number = CHANNELS,
): Uint8Array {
  let pcmLength = 0;
  for (const chunk of chunks) pcmLength += chunk.length;

  const HEADER_SIZE = 44;
  const wav = new Uint8Array(HEADER_SIZE + pcmLength);
  const view = new DataView(wav.buffer);
  const byteRate = sampleRate * channels * BYTES_PER_SAMPLE;

  writeAscii(wav, 0, 'RIFF');
  view.setUint32(4, 36 + pcmLength, true);
  writeAscii(wav, 8, 'WAVE');
  writeAscii(wav, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmtチャンクサイズ
  view.setUint16(20, 1, true); // PCM（無圧縮）
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, channels * BYTES_PER_SAMPLE, true); // ブロックアライン
  view.setUint16(34, BYTES_PER_SAMPLE * 8, true); // ビット深度
  writeAscii(wav, 36, 'data');
  view.setUint32(40, pcmLength, true);

  let offset = HEADER_SIZE;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.length;
  }
  return wav;
}

/** ASCII文字列をバッファへ書き込む（WAVヘッダ用） */
function writeAscii(target: Uint8Array, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    target[offset + i] = text.charCodeAt(i);
  }
}

/** PCMバイト数 → 秒数 */
export function pcmBytesToSeconds(byteLength: number): number {
  return round3(byteLength / BYTES_PER_SECOND);
}

/**
 * WebSocketの受信フレームを文字列へ。
 * 実行環境によって届く型が違う——これがSDKで詰まった箇所の核心：
 *   workerd（本番）: バイナリフレームは ArrayBuffer
 *   Node 22 / ブラウザ: バイナリフレームは Blob（既定のbinaryType）
 *   テキストフレーム: string
 */
export async function socketDataToText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(
      new Uint8Array(data.buffer, data.byteOffset, data.byteLength),
    );
  }
  if (typeof Blob !== 'undefined' && data instanceof Blob) return data.text();
  throw new Error(`未知のWebSocketメッセージ型: ${Object.prototype.toString.call(data)}`);
}

// ============================================
// 副作用：Lyriaセッションからの採取
// ============================================

/**
 * 受信PCMの収集を担うコントローラ。
 * コールバック地獄を避け、cleanup（タイマー解除・状態リセット）を
 * 一箇所に集める（メモリリーク防止ルール準拠：ハンドラはすべてbindで登録）。
 */
class PcmCollector {
  private discardRemaining = 0;
  private captureRemaining = 0;
  private chunks: Uint8Array[] = [];
  private passResolve: ((chunks: Uint8Array[]) => void) | null = null;
  private passReject: ((error: Error) => void) | null = null;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private setupResolve: (() => void) | null = null;
  /** setupCompleteを既に受け取ったか（waitForSetup登録前に届く競合への備え） */
  private setupSeen = false;
  private failure: Error | null = null;
  /** サーバ側でフィルタされたプロンプト（ログ用） */
  readonly filteredPrompts: string[] = [];

  /** setupComplete待ち。以後のsteerはこの後でないと無視される */
  waitForSetup(timeoutMs: number): Promise<void> {
    if (this.failure) return Promise.reject(this.failure);
    if (this.setupSeen) return Promise.resolve();
    return new Promise(this.startSetupWait.bind(this, timeoutMs));
  }

  private startSetupWait(
    timeoutMs: number,
    resolve: () => void,
    reject: (error: Error) => void,
  ): void {
    this.setupResolve = resolve;
    this.passReject = reject;
    this.timeoutId = setTimeout(
      this.onTimeout.bind(this, 'setupComplete待ちがタイムアウト'),
      timeoutMs,
    );
  }

  /** 1パス分のPCMを収集する。settleBytes分を捨ててからcaptureBytes分を集める */
  capturePass(
    settleBytes: number,
    captureBytes: number,
    timeoutMs: number,
  ): Promise<Uint8Array[]> {
    if (this.failure) return Promise.reject(this.failure);
    this.discardRemaining = settleBytes;
    this.captureRemaining = captureBytes;
    this.chunks = [];
    return new Promise(this.startPassWait.bind(this, timeoutMs));
  }

  private startPassWait(
    timeoutMs: number,
    resolve: (chunks: Uint8Array[]) => void,
    reject: (error: Error) => void,
  ): void {
    this.passResolve = resolve;
    this.passReject = reject;
    this.timeoutId = setTimeout(
      this.onTimeout.bind(this, 'PCM収集がタイムアウト'),
      timeoutMs,
    );
  }

  /** パース済みサーバメッセージの受け口 */
  handleMessage(message: LyriaServerMessage): void {
    if (message.setupComplete) {
      this.setupSeen = true;
      if (this.setupResolve) {
        this.clearTimer();
        const resolve = this.setupResolve;
        this.setupResolve = null;
        this.passReject = null;
        resolve();
      }
      return;
    }
    if (message.filteredPrompt?.text) {
      this.filteredPrompts.push(
        `${message.filteredPrompt.text} (${message.filteredPrompt.filteredReason ?? 'unknown'})`,
      );
    }
    // 1メッセージに複数チャンクが載ることがある。全件取り込む
    const audioChunks = message.serverContent?.audioChunks;
    if (!audioChunks || this.captureRemaining <= 0) return;
    for (const chunk of audioChunks) {
      if (this.captureRemaining <= 0) break;
      if (chunk.data) this.ingest(base64ToBytes(chunk.data));
    }
  }

  /** PCMバイト列の取り込み（馴染み待ちの破棄→必要分だけ収集→完了判定） */
  private ingest(incoming: Uint8Array): void {
    let bytes = incoming;
    // 馴染み待ち区間：steerの継ぎ目を捨てる
    if (this.discardRemaining > 0) {
      if (bytes.length <= this.discardRemaining) {
        this.discardRemaining -= bytes.length;
        return;
      }
      bytes = bytes.subarray(this.discardRemaining);
      this.discardRemaining = 0;
    }
    // 必要分だけ切り出して収集（超過分は捨てる＝stem長を正確に保つ）
    if (bytes.length > this.captureRemaining) {
      bytes = bytes.subarray(0, this.captureRemaining);
    }
    this.chunks.push(bytes);
    this.captureRemaining -= bytes.length;

    if (this.captureRemaining <= 0 && this.passResolve) {
      this.clearTimer();
      const resolve = this.passResolve;
      const collected = this.chunks;
      this.passResolve = null;
      this.passReject = null;
      this.chunks = [];
      resolve(collected);
    }
  }

  /** エラーの受け口 */
  handleError(detail: string): void {
    this.fail(new Error(`Lyriaセッションエラー: ${detail}`));
  }

  /** 切断の受け口。収集中の切断は失敗扱い（コード・理由を診断に残す） */
  handleClose(code: number, reason: string): void {
    if (this.passReject || this.setupResolve) {
      this.fail(
        new Error(`Lyriaセッションが収集中に切断されました (code=${code} ${reason})`),
      );
    }
  }

  private onTimeout(reason: string): void {
    this.fail(new Error(reason));
  }

  private fail(error: Error): void {
    this.failure = error;
    this.clearTimer();
    const reject = this.passReject;
    this.setupResolve = null;
    this.passResolve = null;
    this.passReject = null;
    this.chunks = [];
    if (reject) reject(error);
  }

  private clearTimer(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

/**
 * Lyria RealTimeへのWebSocket接続（依存ゼロの最小クライアント）。
 * 受信は逐次キュー（tail）で処理し、Blobデコードの完了順が入れ替わって
 * 音声チャンクの順序が崩れることを防ぐ。
 */
class LyriaSocket {
  private readonly ws: WebSocket;
  private readonly collector: PcmCollector;
  /** 受信処理の逐次実行キュー。フレーム到着順＝処理順を保証する */
  private tail: Promise<void> = Promise.resolve();

  private constructor(ws: WebSocket, collector: PcmCollector) {
    this.ws = ws;
    this.collector = collector;
    ws.addEventListener('message', this.onMessage.bind(this));
    ws.addEventListener('close', this.onClose.bind(this));
    ws.addEventListener('error', this.onError.bind(this));
  }

  /** 接続してopenまで待つ。メッセージハンドラはopen前に登録済み＝取り漏らしなし */
  static open(url: string, collector: PcmCollector): Promise<LyriaSocket> {
    const ws = new WebSocket(url);
    const socket = new LyriaSocket(ws, collector);
    return new Promise(function waitOpen(resolve, reject) {
      function handleOpen(): void {
        ws.removeEventListener('open', handleOpen);
        ws.removeEventListener('error', handleOpenError);
        resolve(socket);
      }
      function handleOpenError(): void {
        ws.removeEventListener('open', handleOpen);
        ws.removeEventListener('error', handleOpenError);
        reject(new Error('LyriaへのWebSocket接続に失敗しました'));
      }
      ws.addEventListener('open', handleOpen);
      ws.addEventListener('error', handleOpenError);
    });
  }

  /** クライアントメッセージ送信（JSONテキストフレーム） */
  send(message: object): void {
    this.ws.send(JSON.stringify(message));
  }

  close(): void {
    try {
      this.ws.close();
    } catch {
      // 既に閉じていれば何もしない
    }
  }

  private onMessage(event: MessageEvent): void {
    // 逐次キューに積む：デコード（Blob等）の完了順の入れ替わりを防ぐ
    this.tail = this.tail.then(this.decodeAndDispatch.bind(this, event.data));
  }

  private async decodeAndDispatch(data: unknown): Promise<void> {
    try {
      const text = await socketDataToText(data);
      this.collector.handleMessage(JSON.parse(text) as LyriaServerMessage);
    } catch (error) {
      // パース不能なフレームは「静かな無視」にしない。原因を必ず表に出す
      this.collector.handleError(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  private onClose(event: CloseEvent): void {
    this.collector.handleClose(event.code, event.reason ?? '');
  }

  private onError(): void {
    this.collector.handleError('WebSocketエラー');
  }
}

/**
 * Lyria RealTimeセッションを1本張り、パス計画に沿って擬似stemsを採取する。
 *
 * コスト保証：
 * - キャプチャ量はパス計画で固定（4 × 48秒 + 馴染み6秒）
 * - 各パスにハードタイムアウト。どんな経路でもfinallyでclose()し、
 *   セッションを漏らさない（張りっぱなしによる課金の継続を防ぐ）
 *
 * @param apiKey GEMINI_API_KEY（呼び出し側がサーバ環境から取得して渡す。
 *               このモジュールは環境変数に直接触れない＝副作用の境界を保つ）
 */
export async function captureStems(options: {
  apiKey: string;
  passes: StemPass[];
  onProgress?: (message: string) => void;
}): Promise<{ stems: CapturedStem[]; filteredPrompts: string[] }> {
  const { apiKey, passes, onProgress } = options;
  if (passes.length === 0) {
    throw new Error('キャプチャパスが空です（有効なテンプレートがありません）');
  }

  const url = `${LYRIA_WS_HOST}/ws/google.ai.generativelanguage.${LYRIA_API_VERSION}.GenerativeService.BidiGenerateMusic?key=${encodeURIComponent(apiKey)}`;
  const collector = new PcmCollector();
  const socket = await LyriaSocket.open(url, collector);

  const settleBytes = SETTLE_SECONDS * BYTES_PER_SECOND;
  const captureBytes = STEM_CAPTURE_SECONDS * BYTES_PER_SECOND;
  const captured: CapturedStem[] = [];

  try {
    socket.send({ setup: { model: LYRIA_MODEL } });
    await collector.waitForSetup(SETUP_TIMEOUT_MS);

    let isFirstPass = true;
    for (const pass of passes) {
      // steer：セッションは張り直さない。設定とプロンプトだけを差し替える
      socket.send({ musicGenerationConfig: pass.config });
      socket.send({ clientContent: { weightedPrompts: pass.prompts } });
      if (isFirstPass) {
        socket.send({ playbackControl: 'PLAY' });
        isFirstPass = false;
      }

      const pcmChunks = await collector.capturePass(
        settleBytes,
        captureBytes,
        PASS_TIMEOUT_MS,
      );
      // パスごとに即WAV化してPCMを手放す（Workersの128MBメモリを守る）
      let pcmLength = 0;
      for (const chunk of pcmChunks) pcmLength += chunk.length;
      captured.push({
        role: pass.role,
        wav: encodeWavFromPcm(pcmChunks),
        durationSec: pcmBytesToSeconds(pcmLength),
      });
      if (onProgress) onProgress(`stem採取完了: ${pass.role}`);
    }

    socket.send({ playbackControl: 'STOP' });
    return { stems: captured, filteredPrompts: [...collector.filteredPrompts] };
  } finally {
    // 成否に関わらずWebSocketを必ず閉じる
    socket.close();
  }
}
