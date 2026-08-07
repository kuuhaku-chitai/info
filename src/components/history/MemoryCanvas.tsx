'use client';

/**
 * 空白地帯 - MemoryCanvas（記憶の粒）
 *
 * music Mode再生中だけ、グラフの下層に苔胞子のような粒が漂う。
 * 粒はReact Flowの**world座標系**に住み、ctx.setTransformで
 * ズーム・パンにピクセル単位で追従する——粒はノードの傍に「留まる」。
 *
 * 「微弱＝状態、強調＝出来事」（plan-canvas-visualizer.md §0）：
 * - 状態の層（常に淡い）：density→粒数40〜160／stillness→明度・速度の沈み／
 *   音（level/low/mid）→明度・漂流速度のゆっくりした揺れ／
 *   absence→斑（粒が避ける空白域）と全体コントラストの低下
 * - 出来事の層（発火して必ず減衰）：
 *   音の山→trendの糸が一瞬明瞭に（立ち上がり0.3秒・減衰2秒）／
 *   silence burst→斑が2秒で広がり4秒で戻る（音と同じ予定時刻）／
 *   echo滲出→最古の四分位ノードに残像の暈（0.4秒で浮かび計4秒で消える。
 *   風化係数に比例＝古い記憶ほど淡い）
 * - α上限：粒0.35・糸0.25・暈0.28。点滅なし。色は既存グレーのみ
 *
 * パフォーマンス規約：
 * - 単一rAF。非再生時はフェードアウト（3秒）→ クリア → rAF完全停止
 * - 起床は500msの見張りタイマー（バスはReactを介さないため）
 * - グロースプライトは1枚を事前描画して使い回す（ctx.filter/shadowは不使用）
 * - DPR上限2。フレーム毎の割り当てを避ける（粒はプール）
 *
 * メモリリーク防止：ハンドラはすべて名前付きメソッドを.bindで登録し、
 * unmountでResizeObserver・タイマー・rAFを必ず解放する。
 */

import { useEffect, useRef } from 'react';
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';
import { visualizerBus } from '@/components/music/visualizerBus';
import { traceContours, type ContourStroke } from '@/components/music/contourTrace';
import { fetchVersionImageRefs } from '@/lib/actions';
import { useHistoryStore } from './historyStore';

/** 粒の総プール数（これ以上は生まれない） */
const MAX_PARTICLES = 220;
/** densityゼロでも漂う基礎の粒数 */
const BASE_PARTICLES = 40;
/** densityによる増分（最大でBASE+120） */
const DENSITY_PARTICLES = 120;
/** 停止時のフェードアウト秒 */
const FADE_OUT_SECONDS = 3;
/** 立ち上がりの秒数（音の無音からの立ち上がりに合わせる） */
const FADE_IN_SECONDS = 2;
/** 粒の不透明度の絶対上限（形状多様性版で0.35→0.45へ引き上げ。それでも半分以下） */
const ALPHA_CAP = 0.90; // 0.45
/** デバイスピクセル比の上限 */
const DPR_CAP = 2;
/** 見張りタイマーの間隔（再生開始の検知用。アイドル時の唯一のコスト） */
const WATCH_MS = 500;
/** 生息域の余白（world px）。viewport追従強化で260→400へ拡大 */
const BOUNDS_PADDING = 400;
/**
 * 生息域からこれ以上外れた粒は「復活」させる（ランダム位置・alive=0から易し込み）。
 * 僅かなはみ出しは従来どおりラップ＝漂流の連続性を保ち、
 * パン・ズームで生息域が跳んだ時だけ静かに転生する
 */
const RESPAWN_MARGIN = 80;

// --- 輪郭（記録の残像：手書き→煙） ---
/** 輪郭のα上限（規約§0改訂値） */
const CONTOUR_ALPHA_CAP = 0.5;
/** 同時に存在できる輪郭の最大数 */
const CONTOUR_MAX_ACTIVE = 2;
/** 自然発生の間隔（秒）。echo滲出とは別に、稀にひとりでに浮かぶ */
const CONTOUR_NATURAL_MIN_SEC = 90;
const CONTOUR_NATURAL_MAX_SEC = 150;
/** 輪郭の描画サイズ（world px・長辺） */
const CONTOUR_SIZE_MIN = 220;
const CONTOUR_SIZE_VAR = 120;
/** 手書きの出現（秒）と保持（秒） */
const CONTOUR_REVEAL_MIN_SEC = 6;
const CONTOUR_REVEAL_VAR_SEC = 4;
const CONTOUR_HOLD_SEC = 4;
/** 輪郭抽出の解像度（長辺px。Sobelはこの縮小画像に対して1回だけ走る） */
const CONTOUR_SAMPLE_PX = 96;

/** ノードの概寸（VersionNode: w-44 = 176px、高さは内容次第の近似値） */
const NODE_W = 176;
const NODE_H = 84;

// --- ダート（音の山・記憶の滲出で一部の粒が突然素早く動く出来事） ---
/** 衝動の減衰秒（約1.2秒で常態の漂流へ戻る＝出来事は必ず微弱へ収束） */
const DART_DECAY_SEC = 1.2;
/** ダート中に上乗せされる速度（world px/秒）。通常漂流は数十px/秒なので明確に速い */
const DART_SPEED = 300;
/** 音の山1回で衝動を受ける粒の基本数（全体220のうちごく一部＝疎ら） */
const DART_PEAK_COUNT = 6;
/** 記憶の滲出（echo）で散る粒の数（山より強い散乱） */
const DART_ECHO_COUNT = 12;

// --- 糸（trendのフィラメント） ---
/** 糸のα上限（出来事のピーク時でもこれ以上は明瞭にならない） */
const FILAMENT_ALPHA_CAP = 0.64; // 0.32
/** 糸の分割数 */
const FILAMENT_SEGMENTS = 10;

// --- 波形の流れる線（音の時間領域波形が線の形になる） ---
/** 流れの最大本数（trendで1〜3本） */
const STREAM_MAX = 3;
/** 1本の線の分割数 */
const STREAM_SEGMENTS = 64;
/** 線の長さ（world px） */
const STREAM_LENGTH = 420;
/** 定常の上限α。出来事（音の山）でSTREAM_PEAK_CAPまで */
const STREAM_ALPHA_CAP = 0.45; // 0.15
const STREAM_PEAK_CAP = 0.3;

// --- 斑の出来事駆動（echo滲出・大変容で深くなる） ---
/** 出来事時の中心減光（0.15→0.05＝ほぼ消える） */
const VOID_CORE_DIM_EVENT = 0.05;
/** 出来事時の半径拡大（+40%） */
const VOID_EVENT_EXPAND = 0.4;
/** 出来事の減衰秒 */
const VOID_EVENT_FALL_SEC = 6;

// --- 斑（absenceの空白域） ---
/** 斑の最大数 */
const VOID_MAX = 4;
/** 斑の中心での粒の減光率（0=完全に消える。わずかに残す） */
const VOID_CORE_DIM = 0.15;
/** burstによる斑の拡大率（+80%） */
const BURST_EXPAND = 0.8;
/** 斑の広がり（秒）と戻り（秒） */
const BURST_RISE_SEC = 2;
const BURST_FALL_SEC = 4;

// --- 暈（echo残像） ---
/** 暈のα上限。風化係数(≤0.5)との積で実効は最大0.28 */
const HALO_ALPHA_CAP = 0.56; // 0.28
/** 浮かぶ速さと全体の長さ（秒） */
const HALO_RISE_SEC = 0.4;
const HALO_TOTAL_SEC = 4;
/** 暈の直径（world px） */
const HALO_SIZE = 340;

// 粒子基礎の底上げ
const BASE_ALPHA = 0.94;                   // 0.09 → 0.14
const MID_ALPHA_COEF = 0.82;               // 0.20 → 0.22
const LEVEL_ALPHA_COEF = 0.65;             // 0.12 → 0.15

interface Particle {
  x: number;
  y: number;
  seed: number;
  size: number;
  phase: number;
  /** 活性 0-1（数の増減はこの値の易しみで表現し、突然の出現・消滅を作らない） */
  alive: number;
  /**
   * 【ダート】衝動 0-1。音の山・記憶の滲出でごく一部の粒だけに立ち、
   * 約1.2秒で減衰する。0の間は従来どおりの静かな漂流（常態は一定でよい）
   */
  dart: number;
  /** ダート方向（衝動が立った瞬間に決まる。減衰中は不変） */
  dartAngle: number;
}

interface VoidSpot {
  x: number;
  y: number;
  radius: number;
  seed: number;
}

interface WorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * 粒の生息域＝ノード群の外接矩形 ∪ 現在のviewportのworld可視域、に余白を足したもの。
 *
 * viewportを合成するのがズーム・パン完全追従の要：
 * ノードから遠くへパンしても、いま見えている場所が常に生息域に含まれ、
 * 粒・流れがそこに「復活」できる。ズームアウトでは可視域が広がり
 * 粒は自然に疎らになる（見渡すほど空白が勝つ——コンセプト通りの振る舞い）。
 *
 * @param viewCssW/H CanvasのCSSサイズ（0なら可視域は合成しない＝初期化時）
 */
function computeBounds(viewCssW: number, viewCssH: number): WorldBounds {
  const nodes = useHistoryStore.getState().nodes;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.x + NODE_W > maxX) maxX = node.position.x + NODE_W;
    if (node.position.y + NODE_H > maxY) maxY = node.position.y + NODE_H;
  }

  // 可視域（screen→world逆変換）を合成
  const vp = visualizerBus.viewport;
  if (viewCssW > 0 && viewCssH > 0 && vp.zoom > 0) {
    const viewMinX = (0 - vp.x) / vp.zoom;
    const viewMinY = (0 - vp.y) / vp.zoom;
    const viewMaxX = (viewCssW - vp.x) / vp.zoom;
    const viewMaxY = (viewCssH - vp.y) / vp.zoom;
    if (viewMinX < minX) minX = viewMinX;
    if (viewMinY < minY) minY = viewMinY;
    if (viewMaxX > maxX) maxX = viewMaxX;
    if (viewMaxY > maxY) maxY = viewMaxY;
  }

  if (!Number.isFinite(minX)) {
    return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
  }
  return {
    minX: minX - BOUNDS_PADDING,
    minY: minY - BOUNDS_PADDING,
    maxX: maxX + BOUNDS_PADDING,
    maxY: maxY + BOUNDS_PADDING,
  };
}

/** 輪郭のライフサイクル1枚分 */
interface ContourInstance {
  strokes: ContourStroke[];
  totalPoints: number;
  anchorX: number;
  anchorY: number;
  /** 長辺のworldサイズ */
  size: number;
  /** 高さ/幅（アスペクト保持） */
  aspect: number;
  bornAt: number;
  revealSec: number;
  dissipateSec: number;
  /**
   * 【速度変化】煙の蓄積時間（秒相当）。壁時計でなくupdate()が
   * smokeRate×dtずつ進める＝散逸の速さが周波数・echo気配・静けさに応じて変わる
   */
  smokeT: number;
  /** 出来事の強さ（echo滲出=1.0／自然発生=0.5） */
  strength: number;
  seed: number;
}

/**
 * 画像URL → 輪郭ストローク（CORS安全）。
 * 抽出は専用オフスクリーンcanvasで行う——主canvasは絶対に汚染させない。
 * CORSヘッダの無い画像（本番R2が未設定の場合）はgetImageDataがSecurityErrorを
 * 投げるため、catchして沈黙にフォールバック（輪郭が現れないだけ。それも空白）。
 */
async function extractContoursFromImage(
  url: string,
): Promise<{ strokes: ContourStroke[]; aspect: number } | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const longSide = Math.max(img.naturalWidth, img.naturalHeight);
    if (longSide === 0) return null;
    const scale = CONTOUR_SAMPLE_PX / longSide;
    const w = Math.max(8, Math.round(img.naturalWidth * scale));
    const h = Math.max(8, Math.round(img.naturalHeight * scale));
    const offscreen = document.createElement('canvas');
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext('2d', { willReadFrequently: true });
    if (!octx) return null;
    octx.drawImage(img, 0, 0, w, h);
    const pixels = octx.getImageData(0, 0, w, h);
    const strokes = traceContours(pixels.data, w, h);
    if (strokes.length === 0) return null;
    return { strokes, aspect: h / w };
  } catch {
    return null;
  }
}

/**
 * グロースプライト（中心グレー値を指定して事前描画）。
 * 色相は持たない——空白地帯の無彩色パレットのまま、
 * 「明るさ」だけがスペクトルに応えて変わる。
 */
function createGlowSprite(centerGray: number): HTMLCanvasElement {
  const SIZE = 64;
  const sprite = document.createElement('canvas');
  sprite.width = SIZE;
  sprite.height = SIZE;
  const ctx = sprite.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(
      SIZE / 2, SIZE / 2, 0,
      SIZE / 2, SIZE / 2, SIZE / 2,
    );
    const g0 = centerGray;
    const g1 = Math.min(230, centerGray + 20);
    const g2 = Math.min(240, centerGray + 40);
    gradient.addColorStop(0, `rgba(${g0}, ${g0 - 2}, ${g0 - 2}, 0.9)`);
    gradient.addColorStop(0.5, `rgba(${g1}, ${g1 - 2}, ${g1 - 2}, 0.25)`);
    gradient.addColorStop(1, `rgba(${g2}, ${g2 - 2}, ${g2 - 2}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  return sprite;
}

/** スペクトル明度の段階数（暗70→明180のグレー。周波数の重心で選ばれる） */
const SPRITE_VARIANTS = 7;
const SPRITE_GRAY_DARK = 70;
const SPRITE_GRAY_RANGE = 110;

/** 明度バリアントを一度だけ事前描画（フレーム内での生成ゼロ） */
function createSpriteVariants(): HTMLCanvasElement[] {
  const sprites: HTMLCanvasElement[] = [];
  for (let i = 0; i < SPRITE_VARIANTS; i++) {
    sprites.push(
      createGlowSprite(SPRITE_GRAY_DARK + (SPRITE_GRAY_RANGE * i) / (SPRITE_VARIANTS - 1)),
    );
  }
  return sprites;
}

class MemoryCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly noise: NoiseFunction2D;
  /** 明度バリアント（暗→明）。スペクトルの重心が毎フレーム1枚を選ぶ */
  private readonly sprites: HTMLCanvasElement[];
  /**
   * スペクトル明度 0-1（低音優勢→0=暗いグレー、高音優勢→1=明るいグレー）。
   * 「低い音は暗く、高い音は明るく」をリアルタイムに、ただし無彩色のまま
   */
  private spectralBright = 0.5;
  /** 低域のなめらか版（斑の膨らみ＝低音で空白が脈打つ） */
  private lowSmooth = 0;

  // ============================================
  // 【速度変化・新規】周波数→アニメーション速度
  // すべて指数平滑の二段構え（帯域→テンポの順に易す）＝急激な速度変化は構造的に不可能
  // ============================================
  /** 中域・高域・全体レベルのなめらか版（速度導出の入力） */
  private midSmooth = 0;
  private highSmooth = 0;
  private levelSmooth = 0;
  /** 粒の速度倍率。低音優勢→0.35（重く）〜 高域優勢→1.9（軽やか） */
  private tempoDrift = 1;
  /** 流れ・糸のnoiseクロック速度倍率。mid+high→速く、低音優勢→ゆったり */
  private tempoFlow = 1;
  /**
   * 【核】音楽時間クロック（秒）。壁時計 t×speed の代わりに dt×tempoFlow を蓄積する。
   * 乗算方式だと速度が変わった瞬間にnoiseの位相が跳ぶが、
   * 積分方式なら位相は常に連続＝どれだけテンポが動いても滑らか
   */
  private flowTime = 0;
  /** 明滅用の時間クロック（高域でわずかに速く・低域でゆっくり。±40%まで） */
  private flickerTime = 0;

  private readonly particles: Particle[] = [];
  private rafId: number | null = null;
  private lastFrameAt = 0;
  /** 全体フェード 0-1。playingへ向かって易す。0で描画停止 */
  private fade = 0;
  private disposed = false;

  // --- 出来事の状態 ---
  /** 中域のゆっくりした平均（音の山の検知基準） */
  private midAverage = 0;
  /** 音の山の強調 0-1（立ち上がり0.3秒・減衰2秒） */
  private peakBoost = 0;
  /** 前フレームの音の山フラグ（立ち上がりエッジ＝ダートのトリガー検出用） */
  private prevIsPeak = false;
  /** 斑の位置（生息域が定まった最初のフレームで固定） */
  private voidSpots: VoidSpot[] | null = null;
  /** 処理済みechoFlashの時刻（新しい滲出の検知用） */
  private lastFlashAt = 0;
  /** 残像の対象（最古の四分位ノードの中心） */
  private haloTargets: Array<{ x: number; y: number }> = [];
  private haloWeathering = 0;
  /** 処理済みmajorEventの時刻 */
  private lastMajorAt = 0;
  /** 斑の出来事駆動 0-1（echo滲出・大変容で1へ跳ね、6秒で減衰） */
  private voidBoost = 0;
  /** 波形のなめらか版（250ms刻みのbus更新を有機的に補間。-1〜1） */
  private readonly waveSmooth = new Float32Array(128);
  /** 波形の流れ（アンカーがnoise場をゆっくり漂う） */
  private readonly streams: Array<{ x: number; y: number; seed: number }> = [];

  // --- 輪郭（記録の残像） ---
  /** 題材となる履歴画像の参照（mount時に一度だけ取得） */
  private imageRefs: Array<{ imageUrl: string; versionId: string }> = [];
  /** 現在浮かんでいる輪郭（最大CONTOUR_MAX_ACTIVE） */
  private readonly contours: ContourInstance[] = [];
  /** 画像ロード・抽出中の多重起動防止 */
  private contourLoading = false;
  /** 次の自然発生の時刻（performance.now()基準） */
  private nextNaturalAt = 0;
  /**
   * 輪郭の題材を投稿ごとに満遍なく出すための輪番キュー（imageRefsのシャッフル）。
   * ランダム抽出だと同じ投稿ばかり選ばれ「5投稿中2つだけ」に偏るため、
   * 一巡するまで同じ投稿を選ばない
   */
  private contourOrder: number[] = [];
  private contourOrderIdx = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.noise = createNoise2D();
    this.sprites = createSpriteVariants();
    // 題材の取得は非同期・失敗は沈黙（輪郭が現れないだけ）
    void this.loadImageRefs();
    const bounds = computeBounds(0, 0);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        seed: Math.random() * 1000,
        size: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        alive: 0,
        dart: 0,
        dartAngle: 0,
      });
    }
  }

  /** 見張りタイマーの受け口：再生が始まっていたらrAFを起こす */
  wake(): void {
    if (this.disposed || this.rafId !== null) return;
    if (visualizerBus.playing || this.fade > 0) {
      this.lastFrameAt = performance.now();
      this.rafId = requestAnimationFrame(this.frame.bind(this));
    }
  }

  /** ResizeObserverの受け口：バッキングストアを親サイズ×DPRに合わせる */
  handleResize(entries: ResizeObserverEntry[]): void {
    const entry = entries[0];
    if (!entry) return;
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(entry.contentRect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(entry.contentRect.height * dpr));
  }

  dispose(): void {
    this.disposed = true;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.contours.length = 0;
    this.clear();
  }

  // ============================================
  // フレーム
  // ============================================

  private frame(now: number): void {
    this.rafId = null;
    if (this.disposed || !this.ctx) return;

    // dtはタブ復帰などの巨大値を丸める（粒の瞬間移動を防ぐ）
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrameAt) / 1000));
    this.lastFrameAt = now;

    // --- 全体フェード：立ち上がり2秒・沈黙3秒 ---
    if (visualizerBus.playing) {
      this.fade = Math.min(1, this.fade + dt / FADE_IN_SECONDS);
    } else {
      this.fade = Math.max(0, this.fade - dt / FADE_OUT_SECONDS);
      if (this.fade <= 0) {
        // 完全に消えたらクリアして眠る（rAFは再スケジュールしない＝コストゼロ）
        this.clear();
        return;
      }
    }

    const workStart = performance.now();
    this.update(dt, now);
    this.draw(now);
    // 性能予算（8ms）の監視値。読み手は開発時の計測とデバッグのみ
    visualizerBus.frameMs = performance.now() - workStart;

    this.rafId = requestAnimationFrame(this.frame.bind(this));
  }

  private update(dt: number, now: number): void {
    const state = visualizerBus.musicState;
    const density = state?.density ?? 0.3;
    const stillness = state?.stillness ?? 0.5;
    const trend = state?.trend ?? 0;
    // 生息域は毎フレーム、現在のviewport可視域と合成される（ズーム・パン追従の要）
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const bounds = computeBounds(this.canvas.width / dpr, this.canvas.height / dpr);

    // --- 音の山（出来事）：中域が自身のゆっくりした平均を大きく超えた時だけ ---
    this.midAverage += (visualizerBus.mid - this.midAverage) * Math.min(1, dt / 6);
    const isPeak =
      visualizerBus.mid > this.midAverage * 1.5 && visualizerBus.mid > 0.12;
    const boostTarget = isPeak ? 0.6 : 0;
    if (boostTarget > this.peakBoost) {
      this.peakBoost += (boostTarget - this.peakBoost) * Math.min(1, dt / 0.3);
    } else {
      this.peakBoost = Math.max(0, this.peakBoost - dt / 2);
    }
    // 【ダート】音の山の立ち上がりエッジ（false→true）で、ごく一部の粒が突然走る。
    // 毎フレームではなく「山が立った瞬間」だけ＝出来事として散発的に起こる
    if (isPeak && !this.prevIsPeak) {
      this.scatterDarts(DART_PEAK_COUNT + Math.round(3 * visualizerBus.high), 0.7);
    }
    this.prevIsPeak = isPeak;

    // --- echo滲出の検知：残像の対象確定＋斑の深化＋記録の残像（輪郭）の出現 ---
    const flash = visualizerBus.echoFlash;
    if (flash && flash.at !== this.lastFlashAt) {
      this.lastFlashAt = flash.at;
      this.haloWeathering = flash.weathering;
      this.haloTargets = this.pickOldestQuartileCenters();
      this.voidBoost = 1;
      // 記憶が滲む時、記録の残像（写真の輪郭）が浮かぶ
      void this.spawnContour(1.0, bounds, stillness);
      // 【ダート】記憶が滲む瞬間、胞子がより強く散る（山より多く・強く）
      this.scatterDarts(DART_ECHO_COUNT, 1.0);
    }
    // --- 大変容の検知：斑を深くする出来事（暈は伴わない） ---
    const major = visualizerBus.majorEvent;
    if (major && major.at !== this.lastMajorAt) {
      this.lastMajorAt = major.at;
      this.voidBoost = 1;
    }
    // 斑の出来事は6秒で必ず微弱へ戻る
    this.voidBoost = Math.max(0, this.voidBoost - dt / VOID_EVENT_FALL_SEC);

    // --- 輪郭の自然発生：90〜150秒に1度、ひとりでに（echoより淡く） ---
    if (this.nextNaturalAt === 0) {
      this.nextNaturalAt =
        now +
        (CONTOUR_NATURAL_MIN_SEC +
          Math.random() * (CONTOUR_NATURAL_MAX_SEC - CONTOUR_NATURAL_MIN_SEC)) * 1000;
    } else if (now >= this.nextNaturalAt && visualizerBus.playing) {
      this.nextNaturalAt = 0; // 次回はspawn後に再抽選
      void this.spawnContour(0.5, bounds, stillness);
    }

    // --- 【速度変化・新規】煙の時間：散逸の進みを蓄積する ---
    // 高域優勢とecho気配（voidBoost）で速く散り、静けさでゆっくり居座る。
    // 壁時計でなく蓄積なので、途中でテンポが変わっても散逸は滑らかに続く
    if (this.contours.length > 0) {
      const smokeRate = Math.max(0.35, Math.min(1.8,
        (0.6 + 0.9 * this.highSmooth + 0.5 * this.voidBoost) * (1 - 0.45 * stillness),
      ));
      for (let ci = this.contours.length - 1; ci >= 0; ci--) {
        const contour = this.contours[ci];
        const age = (now - contour.bornAt) / 1000;
        if (age > contour.revealSec + CONTOUR_HOLD_SEC) {
          contour.smokeT += dt * smokeRate;
          if (contour.smokeT >= contour.dissipateSec) this.contours.splice(ci, 1);
        }
      }
    }

    // --- スペクトル明度：低音優勢→暗く、高音優勢→明るく（無彩色のまま） ---
    const brightTarget = Math.min(1, Math.max(0,
      0.5 + 0.9 * visualizerBus.high - 0.7 * visualizerBus.low + 0.25 * visualizerBus.mid,
    ));
    this.spectralBright += (brightTarget - this.spectralBright) * Math.min(1, dt * 6);
    this.lowSmooth += (visualizerBus.low - this.lowSmooth) * Math.min(1, dt * 5);

    // --- 【速度変化・新規】帯域→テンポの導出 ---
    this.midSmooth += (visualizerBus.mid - this.midSmooth) * Math.min(1, dt * 5);
    this.highSmooth += (visualizerBus.high - this.highSmooth) * Math.min(1, dt * 5);
    this.levelSmooth += (visualizerBus.level - this.levelSmooth) * Math.min(1, dt * 4);
    // 粒のテンポ：高域→軽やかに速く／低音→重くゆっくり／中域→適度に押す
    /*const driftTarget = Math.min(1.9, Math.max(0.35,
      0.7 + 1.1 * this.highSmooth + 0.35 * this.midSmooth - 0.55 * this.lowSmooth,
    ));*/
    const driftTarget = Math.min(8.1, Math.max(10.25,
      0.6 + 1.25 * this.highSmooth          // 高域でもっと軽快に
      + 0.45 * this.midSmooth
      - 0.65 * this.lowSmooth               // 低音優勢時の重さを強調
    ));
    this.tempoDrift += (driftTarget - this.tempoDrift) * Math.min(1, dt * 3);
    // 流れ・糸のテンポ：mid+highで活発、低音優勢でゆったり
    const flowTarget = Math.min(2.2, Math.max(0.3,
      0.6 + 0.9 * this.midSmooth + 1.0 * this.highSmooth - 0.5 * this.lowSmooth,
    ));
    this.tempoFlow += (flowTarget - this.tempoFlow) * Math.min(1, dt * 3);
    // 音楽時間の蓄積（積分）：peakBoost時は一時的に加速（2秒で自然減衰＝出来事）
    this.flowTime += dt * this.tempoFlow * (1 + 0.4 * this.peakBoost);
    // 明滅クロック：優勢帯域でわずかに変化（0.7〜1.4倍。極端にはしない）
    this.flickerTime += dt * Math.min(1.4, Math.max(0.7,
      1 + 0.3 * (this.highSmooth - this.lowSmooth),
    ));

    // --- 波形のなめらか補間：50ms刻みのbus更新を有機的な動きへ（即応寄り） ---
    const wave = visualizerBus.waveform;
    const waveEase = Math.min(1, dt * 8);
    for (let i = 0; i < this.waveSmooth.length; i++) {
      const target = (wave[i] - 128) / 128;
      this.waveSmooth[i] += (target - this.waveSmooth[i]) * waveEase;
    }

    // --- 波形の流れ：trendに応じて1〜3本。アンカーはnoise場をゆっくり漂う ---
    const streamTarget = trend < 0.15 ? 1 : trend < 0.5 ? 2 : STREAM_MAX;
    while (this.streams.length < streamTarget) {
      this.streams.push({
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        seed: Math.random() * 100,
      });
    }
    // 【速度変化】アンカーの移動もnoiseクロックもtempoFlowに乗る
    // （mid+high→速い流れ／低音優勢→重い流れ）
    const streamSpeed = (10 + 20 * trend) * (1 - 0.5 * stillness) * this.tempoFlow;
    for (const stream of this.streams) {
      const angle = this.noise(stream.seed * 1.7, this.flowTime * 0.015) * Math.PI * 2;
      stream.x += Math.cos(angle) * streamSpeed * dt;
      stream.y += Math.sin(angle) * streamSpeed * dt;
      // パン・ズームで生息域が跳んだら可視域内へ転生（僅かなはみ出しはラップ）
      this.keepInBounds(stream, bounds);
    }

    // --- 斑：生息域から完全に外れた斑は可視域内へ移す（absence高でどこを見ても斑がある） ---
    if (this.voidSpots) {
      for (const spot of this.voidSpots) {
        const margin = spot.radius * 1.5;
        if (
          spot.x < bounds.minX - margin || spot.x > bounds.maxX + margin ||
          spot.y < bounds.minY - margin || spot.y > bounds.maxY + margin
        ) {
          spot.x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
          spot.y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        }
      }
    }

    // --- 斑の位置決め（初回のみ。以後は半径だけがゆっくり呼吸する） ---
    if (this.voidSpots === null) {
      this.voidSpots = [];
      for (let i = 0; i < VOID_MAX; i++) {
        this.voidSpots.push({
          x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
          y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
          radius: 120 + Math.random() * 100,
          seed: Math.random() * 100,
        });
      }
    }

    // 粒の数：density→活性目標。増減はaliveの易しみ（2秒）で滑らかに
    const activeTarget = Math.min(
      MAX_PARTICLES,
      Math.round(BASE_PARTICLES + DENSITY_PARTICLES * density),
    );

    // 【速度変化】漂流速度：trendで目覚め、stillnessで沈み、
    // tempoDrift（低音→重く0.35／高域→軽やか1.9）が倍率で乗る。
    // peakBoost（音の山）とlevelで一時ブースト——peakは2秒で必ず減衰（出来事）
    const speed =
      (7 + 36 * trend) *
      this.tempoDrift *
      (1 + 0.5 * this.peakBoost + 0.2 * this.levelSmooth) *
      (1 - 0.65 * stillness);

    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const targetAlive = i < activeTarget ? 1 : 0;
      p.alive += (targetAlive - p.alive) * Math.min(1, dt / 2);

      if (p.alive <= 0.01) {
        // 死んでいる粒も生息域外なら位置だけ移しておく（次の目覚めは可視域から）
        if (!this.isNearBounds(p, bounds)) this.respawnInBounds(p, bounds, false);
        continue;
      }
      // 【速度変化】noise場の時間項は壁時計ではなく音楽時間（flowTime）
      // ＝場の変化そのものもテンポで速く・遅くなる
      let angle =
        this.noise(p.x * 0.0015 + this.flowTime * 0.02, p.y * 0.0015 + p.seed) * Math.PI * 2;
      // 【速度変化】中域の躍動：細かなジグザグ（sinのみ・noise追加呼び出しなし）
      angle += Math.sin(this.flowTime * 7 + p.seed * 13) * 0.9 * this.midSmooth;
      p.x += Math.cos(angle) * speed * dt;
      p.y += Math.sin(angle) * speed * dt;

      // 【ダート】衝動が立っている粒だけ、決まった方向へ一気に走る（約1.2秒で減衰）。
      // 通常の漂流に上乗せする＝「特定の粒だけ突然素早く動く」出来事
      if (p.dart > 0.01) {
        const dartSpeed = DART_SPEED * p.dart;
        p.x += Math.cos(p.dartAngle) * dartSpeed * dt;
        p.y += Math.sin(p.dartAngle) * dartSpeed * dt;
        p.dart = Math.max(0, p.dart - dt / DART_DECAY_SEC);
      }

      // 僅かなはみ出しはラップ（漂流の連続性）、
      // パン・ズームで生息域が跳んだ時は転生（alive=0から易し込み＝ポップしない）
      this.keepInBounds(p, bounds);
    }

    // 開発時のみ：ダート発火の検証用に、走っている粒数を毎フレーム露出（本番は無効）
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      let active = 0;
      for (const p of this.particles) if (p.dart > 0.01) active++;
      (window as unknown as Record<string, number>).__kuuhakuDartActive = active;
    }
  }

  /**
   * 【ダート】生きている粒からcount個を無作為に選び、共通ではなく個別の方向へ
   * 衝動を与える（散乱）。既に走っている粒は強い方を採る。
   * noise呼び出しゼロ・軽量（Math.random数回のみ）。
   */
  private scatterDarts(count: number, strength: number): void {
    const pool = this.particles;
    if (pool.length === 0) return;
    for (let n = 0; n < count; n++) {
      // 生きている粒に確実に当てる（無作為だと死んだ粒に外れて発火が弱る）。
      // 最大6回のrejection samplingでalive粒を引く——noiseなし・超軽量
      let p = pool[Math.floor(Math.random() * pool.length)];
      for (let tries = 0; tries < 6 && p.alive <= 0.5; tries++) {
        p = pool[Math.floor(Math.random() * pool.length)];
      }
      if (p.alive > 0.5 && strength > p.dart) {
        p.dart = strength;
        p.dartAngle = Math.random() * Math.PI * 2;
      }
    }
  }

  /** 生息域の近傍（RESPAWN_MARGIN内）にいるか */
  private isNearBounds(pos: { x: number; y: number }, bounds: WorldBounds): boolean {
    return (
      pos.x >= bounds.minX - RESPAWN_MARGIN && pos.x <= bounds.maxX + RESPAWN_MARGIN &&
      pos.y >= bounds.minY - RESPAWN_MARGIN && pos.y <= bounds.maxY + RESPAWN_MARGIN
    );
  }

  /** 生息域内のランダム位置へ。aliveを持つ対象はfadeInで静かに現れ直す */
  private respawnInBounds(
    target: { x: number; y: number; alive?: number },
    bounds: WorldBounds,
    fadeIn: boolean,
  ): void {
    target.x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
    target.y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
    if (fadeIn && typeof target.alive === 'number') target.alive = 0;
  }

  /** 僅かなはみ出しはラップ、遠く外れたら転生（粒・流れ共通） */
  private keepInBounds(
    pos: { x: number; y: number; alive?: number },
    bounds: WorldBounds,
  ): void {
    if (!this.isNearBounds(pos, bounds)) {
      this.respawnInBounds(pos, bounds, true);
      return;
    }
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    if (pos.x < bounds.minX) pos.x += w;
    else if (pos.x > bounds.maxX) pos.x -= w;
    if (pos.y < bounds.minY) pos.y += h;
    else if (pos.y > bounds.maxY) pos.y -= h;
  }

  private draw(now: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const { width, height } = this.canvas;
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    const vp = visualizerBus.viewport;
    const state = visualizerBus.musicState;
    const stillness = state?.stillness ?? 0.5;
    const absence = state?.absence ?? 0;
    const trend = state?.trend ?? 0;

    // クリアはscreen座標で、描画はworld座標で
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.setTransform(dpr * vp.zoom, 0, 0, dpr * vp.zoom, dpr * vp.x, dpr * vp.y);

    const t = now / 1000;

    // 出来事の層（粒の下に敷く）：残像の暈 → trendの糸 → 波形の流れ
    // （糸・流れの時間はflowTimeが内包するため、壁時計tは斑の呼吸だけに渡す）
    this.drawHalos(ctx, now);
    this.drawFilaments(ctx, trend);
    this.drawStreams(ctx, trend, stillness);

    // 明度：中域と全体レベルでゆっくり揺れ、stillnessとabsenceで沈む
    // （形状多様性版：基礎を底上げしてインパクトを出す。上限0.45は§0の改訂規約）
    const baseAlpha = Math.min(
      ALPHA_CAP,
      (BASE_ALPHA + MID_ALPHA_COEF * visualizerBus.mid + LEVEL_ALPHA_COEF * visualizerBus.level) *
      (1 - 0.6 * stillness) *
      (1 - 0.45 * absence) * // absenceの影響を少し強く
      this.fade,
    );

    const burstMul = this.burstRadiusMultiplier(now);
    for (const p of this.particles) {
      if (p.alive <= 0.01) continue;
      // 個体差のゆっくりした明滅（4〜7秒周期・±30%）
      // 【速度変化】時間軸は明滅クロック（高域でわずかに速く・低域でゆっくり）
      const flicker = 0.7 + 0.3 * Math.sin(this.flickerTime * (0.9 + p.seed % 0.6) + p.phase);
      // 斑：空白域の中では粒が薄れる（absence→斑の数、burst→斑の広がり）
      const dim = this.voidDimAt(p.x, p.y, absence, burstMul, t);
      // 【ダート】走っている粒は一瞬だけ明るく（0.6倍まで）＝視線が拾える
      const dartGlow = 1 + 0.6 * p.dart;
      ctx.globalAlpha = Math.min(ALPHA_CAP, baseAlpha * p.alive * flicker * dim * dartGlow);
      const d = p.size * 4; // スプライトは中心グローなので実寸の4倍で描く
      ctx.drawImage(this.spectralSprite(), p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;

    // 記録の残像（輪郭）：粒の上に、手書き→煙のライフサイクルで
    this.drawContours(ctx, now, stillness);
  }

  // ============================================
  // 出来事の層
  // ============================================

  /** 最古の四分位ノードの中心（VersionNodeのopacity=記憶の風化を年代の代理に使う） */
  private pickOldestQuartileCenters(): Array<{ x: number; y: number }> {
    const nodes = useHistoryStore.getState().nodes;
    if (nodes.length === 0) return [];
    const sorted = [...nodes].sort(function byOpacity(a, b) {
      return a.data.opacity - b.data.opacity;
    });
    const count = Math.max(1, Math.ceil(sorted.length / 4));
    return sorted.slice(0, count).map(function toCenter(node) {
      return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H / 2 };
    });
  }

  /** echo残像：滲出の瞬間に浮かび、風化係数に比例した濃さで約4秒かけて消える */
  private drawHalos(ctx: CanvasRenderingContext2D, now: number): void {
    if (this.haloTargets.length === 0 || this.lastFlashAt === 0) return;
    const elapsed = (now - this.lastFlashAt) / 1000;
    if (elapsed < 0 || elapsed > HALO_TOTAL_SEC) return;

    const envelope =
      elapsed < HALO_RISE_SEC
        ? elapsed / HALO_RISE_SEC
        : Math.max(0, 1 - (elapsed - HALO_RISE_SEC) / (HALO_TOTAL_SEC - HALO_RISE_SEC));
    // 風化係数(0.15-0.5)を0-1へ正規化して掛ける：古い記憶ほど淡い残像
    const alpha = HALO_ALPHA_CAP * (this.haloWeathering / 0.5) * envelope * this.fade;
    if (alpha < 0.005) return;

    // 暈も音に呼吸する：中高域の瞬きがそのまま濃さに乗る（リアルタイム反応）
    const pulse = 0.7 + 0.3 * Math.min(1, visualizerBus.mid + visualizerBus.high);
    ctx.globalAlpha = alpha * pulse;
    const sprite = this.spectralSprite();
    for (const target of this.haloTargets) {
      ctx.drawImage(
        sprite,
        target.x - HALO_SIZE / 2,
        target.y - HALO_SIZE / 2,
        HALO_SIZE,
        HALO_SIZE,
      );
    }
    ctx.globalAlpha = 1;
  }

  /** スペクトル明度に応じたスプライト（暗→明の7段階から毎フレーム選ぶ） */
  private spectralSprite(): HTMLCanvasElement {
    const index = Math.round(this.spectralBright * (this.sprites.length - 1));
    return this.sprites[Math.min(this.sprites.length - 1, Math.max(0, index))];
  }

  /**
   * スペクトル明度に応じた線色。deltaで要素ごとの基準差を付ける
   * （輪郭は墨寄り、糸・波形は淡め）。低音優勢→暗く、高音優勢→明るく
   */
  private strokeGray(delta: number): string {
    const v = Math.min(200, Math.max(40,
      Math.round(60 + 110 * this.spectralBright + delta),
    ));
    return `rgb(${v}, ${v - 2}, ${v - 2})`;
  }

  /** trendの糸：エッジ沿いの微かなフィラメント。音の山（peakBoost）で一瞬だけ明瞭に */
  private drawFilaments(ctx: CanvasRenderingContext2D, trend: number): void {
    const alpha = Math.min(
      FILAMENT_ALPHA_CAP,
      this.fade * trend * (0.04 + 0.12 * visualizerBus.mid + this.peakBoost),
    );
    if (alpha < 0.005) return;

    const store = useHistoryStore.getState();
    if (store.edges.length === 0) return;
    const positionById = new Map<string, { x: number; y: number }>();
    for (const node of store.nodes) positionById.set(node.id, node.position);

    // 揺らぎの振幅：trend・中域で育ち、高域の擦れと音の山でさらに膨らむ
    const amplitude =
      5 + 22 * trend + 14 * visualizerBus.mid + 12 * visualizerBus.high + 10 * this.peakBoost;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.strokeGray(0);
    ctx.lineWidth = 0.8;
    for (let k = 0; k < store.edges.length; k++) {
      const edge = store.edges[k];
      const source = positionById.get(edge.source);
      const target = positionById.get(edge.target);
      if (!source || !target) continue;
      // Handleの位置に合わせる：source下辺中央 → target上辺中央
      const x0 = source.x + NODE_W / 2;
      const y0 = source.y + NODE_H;
      const x1 = target.x + NODE_W / 2;
      const y1 = target.y;
      const dx = x1 - x0;
      const dy = y1 - y0;
      const length = Math.hypot(dx, dy) || 1;
      const nx = -dy / length;
      const ny = dx / length;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let i = 1; i <= FILAMENT_SEGMENTS; i++) {
        const s = i / FILAMENT_SEGMENTS;
        // 端は留め、中ほどが揺れる（sinの窓）——枝は幹から離れない
        // 【速度変化】揺らぎの時間は音楽時間（flowTime）＝high/midで活発・低音でゆったり
        const sway =
          this.noise(s * 2.1 + this.flowTime * 0.15, k * 7.7) * amplitude * Math.sin(s * Math.PI);
        ctx.lineTo(x0 + dx * s + nx * sway, y0 + dy * s + ny * sway);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 波形の流れる線：音の時間領域波形そのものが線の形になる。
   * trendが高いほど本数が増え（1〜3本）、定常は淡く（α≤0.15）、
   * 音の山（peakBoost共有）で一瞬だけ明瞭に（α≤0.30・2秒減衰）。
   */
  private drawStreams(
    ctx: CanvasRenderingContext2D,
    trend: number,
    stillness: number,
  ): void {
    const steady = Math.min(
      STREAM_ALPHA_CAP,
      this.fade *
      (0.05 + 0.18 * trend) *
      (0.3 + 0.7 * visualizerBus.mid) *
      (1 - 0.5 * stillness),
    );
    const alpha = Math.min(
      STREAM_PEAK_CAP,
      steady + 0.15 * this.peakBoost + 0.1 * visualizerBus.high,
    );
    if (alpha < 0.005 || this.streams.length === 0) return;

    // 波形の振幅：音量・中域・高域の煌めきで育つ（world px）
    const amplitude =
      10 + 40 * visualizerBus.level + 20 * visualizerBus.mid + 14 * visualizerBus.high;
    const streamTarget = trend < 0.15 ? 1 : trend < 0.5 ? 2 : STREAM_MAX;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = this.strokeGray(-10);
    ctx.lineWidth = 1;
    for (let k = 0; k < Math.min(streamTarget, this.streams.length); k++) {
      const stream = this.streams[k];
      // 線の向き：noiseでゆっくり回る
      // 【速度変化】回転もうねりも音楽時間（flowTime）で進む＝テンポに乗る
      const dirAngle = this.noise(stream.seed * 3.1, this.flowTime * 0.02) * Math.PI;
      const dx = Math.cos(dirAngle);
      const dy = Math.sin(dirAngle);
      const nx = -dy;
      const ny = dx;

      ctx.beginPath();
      for (let i = 0; i <= STREAM_SEGMENTS; i++) {
        const s = i / STREAM_SEGMENTS;
        const along = (s - 0.5) * STREAM_LENGTH;
        // 基礎のうねり＋波形サンプル（端はsin窓で留める）
        const curve = this.noise(s * 1.7 + this.flowTime * 0.08, stream.seed) * 26;
        // 【速度変化】波形の進行：サンプル位置がflowTimeでスクロール＝
        // 波形そのものが線に沿って「流れる」。mid+highが高いほど速く進む
        const waveIndex = ((Math.floor(s * 127 + this.flowTime * 22) % 128) + 128) % 128;
        const sample = this.waveSmooth[waveIndex];
        const offset = curve + sample * amplitude * Math.sin(s * Math.PI);
        const px = stream.x + dx * along + nx * offset;
        const py = stream.y + dy * along + ny * offset;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ============================================
  // 輪郭（記録の残像：手書き→煙）
  // ============================================

  /** 題材（履歴画像の参照）を一度だけ取得し、輪番キューをシャッフルで用意。失敗は沈黙 */
  private async loadImageRefs(): Promise<void> {
    try {
      this.imageRefs = await fetchVersionImageRefs();
    } catch {
      this.imageRefs = [];
    }
    // 輪番の順序をシャッフル（Fisher-Yates）。以後この順で一巡し、
    // 一巡し終えたら再シャッフル＝どの投稿も均等に、かつ毎回同じ順にはならない
    this.contourOrder = this.imageRefs.map(function toIndex(_ref, i) { return i; });
    for (let i = this.contourOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.contourOrder[i], this.contourOrder[j]] = [this.contourOrder[j], this.contourOrder[i]];
    }
    this.contourOrderIdx = 0;
  }

  /** 輪番で次の題材を返す（全投稿を一巡してから再シャッフル） */
  private nextImageRef(): { imageUrl: string; versionId: string } | null {
    if (this.contourOrder.length === 0) return null;
    if (this.contourOrderIdx >= this.contourOrder.length) {
      // 一巡完了：順序を組み替えて次の巡へ（同じ並びの繰り返しを避ける）
      for (let i = this.contourOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this.contourOrder[i], this.contourOrder[j]] = [this.contourOrder[j], this.contourOrder[i]];
      }
      this.contourOrderIdx = 0;
    }
    return this.imageRefs[this.contourOrder[this.contourOrderIdx++]] ?? null;
  }

  /**
   * 輪郭を1枚浮かべる（echo滲出=strength 1.0／自然発生=0.5）。
   * 画像ロード→オフスクリーン抽出は非同期。失敗・上限・多重はすべて静かに見送る
   */
  private async spawnContour(
    strength: number,
    bounds: WorldBounds,
    stillness: number,
  ): Promise<void> {
    if (this.disposed || this.contourLoading) return;
    if (this.contours.length >= CONTOUR_MAX_ACTIVE) return;
    if (this.imageRefs.length === 0) return;
    this.contourLoading = true;
    try {
      // 輪番で次の投稿を選ぶ（ランダム抽出をやめ、全投稿へ満遍なく）
      const ref = this.nextImageRef();
      if (!ref) return;
      const extracted = await extractContoursFromImage(ref.imageUrl);
      if (!extracted || this.disposed) return;

      // 描画位置：その画像が属するノードの傍。ノードが消えていれば可視域のどこか
      const anchor = this.contourAnchor(ref.versionId, bounds);
      let totalPoints = 0;
      for (const stroke of extracted.strokes) totalPoints += stroke.points.length;

      this.contours.push({
        strokes: extracted.strokes,
        totalPoints,
        anchorX: anchor.x,
        anchorY: anchor.y,
        size: CONTOUR_SIZE_MIN + Math.random() * CONTOUR_SIZE_VAR,
        aspect: extracted.aspect,
        bornAt: performance.now(),
        revealSec: CONTOUR_REVEAL_MIN_SEC + Math.random() * CONTOUR_REVEAL_VAR_SEC,
        // 煙の散逸：stillnessが高いほどゆっくり長く居座る
        dissipateSec: 6 + 10 * stillness,
        // 【速度変化】煙の蓄積時間（update側でsmokeRate×dtずつ進む）
        smokeT: 0,
        strength,
        seed: Math.random() * 100,
      });
    } finally {
      this.contourLoading = false;
    }
  }

  /** 輪郭のアンカー：属するノードの中心。無ければ生息域のランダム位置 */
  private contourAnchor(
    versionId: string,
    bounds: WorldBounds,
  ): { x: number; y: number } {
    const nodes = useHistoryStore.getState().nodes;
    const owner = nodes.find(function matchId(n) { return n.id === versionId; });
    if (owner) {
      return { x: owner.position.x + NODE_W / 2, y: owner.position.y + NODE_H / 2 };
    }
    return {
      x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
      y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
    };
  }

  /**
   * 輪郭の描画：手書きのように段々と現れ（ストローク順・点順）、
   * 保持ののち、各点がnoiseで上方へ漂いながら煙のように散る。
   * 出来事の表現だが、αはCONTOUR_ALPHA_CAP×strengthを決して超えない。
   */
  private drawContours(ctx: CanvasRenderingContext2D, now: number, stillness: number): void {
    if (this.contours.length === 0) return;

    for (let ci = this.contours.length - 1; ci >= 0; ci--) {
      const contour = this.contours[ci];
      const age = (now - contour.bornAt) / 1000;

      const reveal = Math.min(1, age / contour.revealSec);
      // 【速度変化】散逸の進みは壁時計ではなく蓄積時間（update()がテンポで進める）。
      // 消滅の判定もupdate()側なので、ここは読むだけ
      const dissipate = Math.min(1, contour.smokeT / contour.dissipateSec);
      // 立ち上がりの1秒で滲み出し、散逸で消えていく
      const alpha =
        CONTOUR_ALPHA_CAP * contour.strength * this.fade *
        Math.min(1, age) * (1 - dissipate);
      if (alpha < 0.005) continue;

      const w = contour.size;
      const h = contour.size * contour.aspect;
      const originX = contour.anchorX - w / 2;
      const originY = contour.anchorY - h / 2;
      // 煙の変位：散逸が進むほど各点がほどけ、上方へ漂う
      const shred = dissipate * 46;
      const lift = dissipate * 70 * (0.5 + stillness);
      // 【速度変化】煙のnoise時間も蓄積時間から＝高域優勢で速くほどける
      const smokeT = contour.smokeT * 0.5;

      ctx.globalAlpha = alpha;
      // 輪郭は他要素より墨寄り（-25）。それでもスペクトルの明暗に呼吸する
      ctx.strokeStyle = this.strokeGray(-25);
      ctx.lineWidth = 1;
      let drawnPoints = 0;
      const pointBudget = Math.ceil(contour.totalPoints * reveal);
      for (let si = 0; si < contour.strokes.length; si++) {
        if (drawnPoints >= pointBudget) break;
        const points = contour.strokes[si].points;
        ctx.beginPath();
        for (let pi = 0; pi < points.length; pi++) {
          if (drawnPoints >= pointBudget) break;
          drawnPoints++;
          const p = points[pi];
          let px = originX + p.x * w;
          let py = originY + p.y * h;
          if (dissipate > 0) {
            px += this.noise(si * 7.3 + pi * 0.11, smokeT + contour.seed) * shred;
            py += this.noise(pi * 0.13 + contour.seed, smokeT + si * 3.7) * shred - lift;
          }
          if (pi === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** burstによる斑の拡大率：2秒で広がり、burstの長さだけ保ち、4秒で戻る */
  private burstRadiusMultiplier(now: number): number {
    const burst = visualizerBus.silenceBurst;
    if (!burst) return 1;
    const elapsed = (now - burst.at) / 1000;
    if (elapsed < 0) return 1; // まだ予定時刻前
    const holdEnd = BURST_RISE_SEC + burst.durationSec;
    let envelope = 0;
    if (elapsed < BURST_RISE_SEC) envelope = elapsed / BURST_RISE_SEC;
    else if (elapsed < holdEnd) envelope = 1;
    else envelope = Math.max(0, 1 - (elapsed - holdEnd) / BURST_FALL_SEC);
    return 1 + BURST_EXPAND * envelope;
  }

  /**
   * 斑による粒の減光。absence→斑の数、中心ほど薄れ、burstで域が広がる。
   * 出来事（echo滲出・大変容）ではvoidBoostにより中心が0.15→0.05まで深くなり、
   * 半径も+40%——空白が一瞬、強く口を開けて6秒で戻る。
   */
  private voidDimAt(
    x: number,
    y: number,
    absence: number,
    burstMul: number,
    t: number,
  ): number {
    if (!this.voidSpots || absence <= 0) return 1;
    const activeSpots = Math.min(VOID_MAX, Math.max(1, Math.round(absence * VOID_MAX)));
    const coreDim =
      VOID_CORE_DIM + (VOID_CORE_DIM_EVENT - VOID_CORE_DIM) * this.voidBoost;
    const eventMul = 1 + VOID_EVENT_EXPAND * this.voidBoost;
    let dim = 1;
    for (let i = 0; i < activeSpots; i++) {
      const spot = this.voidSpots[i];
      // 半径はゆっくり呼吸（±15%）し、burst・出来事で一時的に広がる
      // 低音で空白が膨らむ：noiseのゆっくりした呼吸に低域の脈が重なる
      const breathing = 1 + 0.15 * this.noise(spot.seed, t * 0.05) + 0.25 * this.lowSmooth;
      const radius = spot.radius * breathing * burstMul * eventMul;
      const distance = Math.hypot(x - spot.x, y - spot.y);
      if (distance >= radius) continue;
      const factor = distance / radius; // 0=中心, 1=縁
      dim *= coreDim + (1 - coreDim) * factor * factor;
    }
    return dim;
  }

  private clear(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}

export function MemoryCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(function mountRenderer() {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const renderer = new MemoryCanvasRenderer(canvas);
    const observer = new ResizeObserver(renderer.handleResize.bind(renderer));
    observer.observe(parent);
    // 再生開始の検知（バスはReactを介さないため、軽い見張りで起こす）
    const watcher = setInterval(renderer.wake.bind(renderer), WATCH_MS);

    return function cleanup() {
      clearInterval(watcher);
      observer.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    // w-full h-full の明示が必須：canvasは「置換要素」のため、絶対配置でも
    // inset-0だけでは伸びない（width:autoがビットマップの固有サイズ＝
    // CSSサイズ×DPRに解決され、rightが無視されてページからはみ出す）。
    // これが「Canvasの高さによる不要なスクロール」の正体だった
    <canvas
      ref={canvasRef}
      className="memory-canvas absolute inset-0 block w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  );
}
