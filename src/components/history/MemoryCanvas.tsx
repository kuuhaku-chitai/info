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
/** 粒の不透明度の絶対上限（§0の規約） */
const ALPHA_CAP = 0.35;
/** デバイスピクセル比の上限 */
const DPR_CAP = 2;
/** 見張りタイマーの間隔（再生開始の検知用。アイドル時の唯一のコスト） */
const WATCH_MS = 500;
/** ノード群の外側にどれだけ粒の領域を広げるか（world px） */
const BOUNDS_PADDING = 260;

/** ノードの概寸（VersionNode: w-44 = 176px、高さは内容次第の近似値） */
const NODE_W = 176;
const NODE_H = 84;

// --- 糸（trendのフィラメント） ---
/** 糸のα上限（出来事のピーク時でもこれ以上は明瞭にならない） */
const FILAMENT_ALPHA_CAP = 0.25;
/** 糸の分割数 */
const FILAMENT_SEGMENTS = 10;

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
const HALO_ALPHA_CAP = 0.28;
/** 浮かぶ速さと全体の長さ（秒） */
const HALO_RISE_SEC = 0.4;
const HALO_TOTAL_SEC = 4;
/** 暈の直径（world px） */
const HALO_SIZE = 340;

interface Particle {
  x: number;
  y: number;
  seed: number;
  size: number;
  phase: number;
  /** 活性 0-1（数の増減はこの値の易しみで表現し、突然の出現・消滅を作らない） */
  alive: number;
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

/** ノード群から粒の生息域を求める。ノードが無い間は原点まわりの静かな領域 */
function computeBounds(): WorldBounds {
  const nodes = useHistoryStore.getState().nodes;
  if (nodes.length === 0) {
    return { minX: -400, minY: -300, maxX: 400, maxY: 300 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    if (node.position.x < minX) minX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
    if (node.position.x > maxX) maxX = node.position.x;
    if (node.position.y > maxY) maxY = node.position.y;
  }
  return {
    minX: minX - BOUNDS_PADDING,
    minY: minY - BOUNDS_PADDING,
    maxX: maxX + BOUNDS_PADDING + NODE_W,
    maxY: maxY + BOUNDS_PADDING + NODE_H,
  };
}

/** グロースプライト（中心が淡い灰、外へ透明）を1枚だけ事前描画する */
function createGlowSprite(): HTMLCanvasElement {
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
    // 既存パレットのghost灰。色は増やさない（§0）
    gradient.addColorStop(0, 'rgba(120, 118, 118, 0.9)');
    gradient.addColorStop(0.5, 'rgba(140, 138, 138, 0.25)');
    gradient.addColorStop(1, 'rgba(160, 158, 158, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SIZE, SIZE);
  }
  return sprite;
}

class MemoryCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly noise: NoiseFunction2D;
  private readonly sprite: HTMLCanvasElement;
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
  /** 斑の位置（生息域が定まった最初のフレームで固定） */
  private voidSpots: VoidSpot[] | null = null;
  /** 処理済みechoFlashの時刻（新しい滲出の検知用） */
  private lastFlashAt = 0;
  /** 残像の対象（最古の四分位ノードの中心） */
  private haloTargets: Array<{ x: number; y: number }> = [];
  private haloWeathering = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.noise = createNoise2D();
    this.sprite = createGlowSprite();
    const bounds = computeBounds();
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        x: bounds.minX + Math.random() * (bounds.maxX - bounds.minX),
        y: bounds.minY + Math.random() * (bounds.maxY - bounds.minY),
        seed: Math.random() * 1000,
        size: 1.5 + Math.random() * 2.5,
        phase: Math.random() * Math.PI * 2,
        alive: 0,
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
    const bounds = computeBounds();

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

    // --- echo滲出の検知：新しいflashで残像の対象を確定 ---
    const flash = visualizerBus.echoFlash;
    if (flash && flash.at !== this.lastFlashAt) {
      this.lastFlashAt = flash.at;
      this.haloWeathering = flash.weathering;
      this.haloTargets = this.pickOldestQuartileCenters();
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

    // 漂流速度：trendと低域で目覚め、stillnessで沈む（world px/秒）
    const speed =
      (6 + 40 * trend + 30 * visualizerBus.low) * (1 - 0.7 * stillness);

    const t = now / 1000;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const targetAlive = i < activeTarget ? 1 : 0;
      p.alive += (targetAlive - p.alive) * Math.min(1, dt / 2);

      if (p.alive <= 0.01) continue;
      // 有機的な漂流：noise場の向きへゆっくり進む
      const angle =
        this.noise(p.x * 0.0015 + t * 0.02, p.y * 0.0015 + p.seed) * Math.PI * 2;
      p.x += Math.cos(angle) * speed * dt;
      p.y += Math.sin(angle) * speed * dt;

      // 生息域の外へ出たら反対側から戻る（密度を保つ・境界の壁を作らない）
      const w = bounds.maxX - bounds.minX;
      const h = bounds.maxY - bounds.minY;
      if (p.x < bounds.minX) p.x += w;
      else if (p.x > bounds.maxX) p.x -= w;
      if (p.y < bounds.minY) p.y += h;
      else if (p.y > bounds.maxY) p.y -= h;
    }
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

    // 出来事の層（粒の下に敷く）：残像の暈 → trendの糸
    this.drawHalos(ctx, now);
    this.drawFilaments(ctx, t, trend);

    // 明度：中域と全体レベルでゆっくり揺れ、stillnessとabsenceで沈む
    const baseAlpha = Math.min(
      ALPHA_CAP,
      (0.06 + 0.18 * visualizerBus.mid + 0.1 * visualizerBus.level) *
        (1 - 0.6 * stillness) *
        (1 - 0.3 * absence) * // 欠落はコントラストも奪う
        this.fade,
    );

    const burstMul = this.burstRadiusMultiplier(now);
    for (const p of this.particles) {
      if (p.alive <= 0.01) continue;
      // 個体差のゆっくりした明滅（4〜7秒周期・±30%）
      const flicker = 0.7 + 0.3 * Math.sin(t * (0.9 + p.seed % 0.6) + p.phase);
      // 斑：空白域の中では粒が薄れる（absence→斑の数、burst→斑の広がり）
      const dim = this.voidDimAt(p.x, p.y, absence, burstMul, t);
      ctx.globalAlpha = baseAlpha * p.alive * flicker * dim;
      const d = p.size * 4; // スプライトは中心グローなので実寸の4倍で描く
      ctx.drawImage(this.sprite, p.x - d / 2, p.y - d / 2, d, d);
    }
    ctx.globalAlpha = 1;
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

    ctx.globalAlpha = alpha;
    for (const target of this.haloTargets) {
      ctx.drawImage(
        this.sprite,
        target.x - HALO_SIZE / 2,
        target.y - HALO_SIZE / 2,
        HALO_SIZE,
        HALO_SIZE,
      );
    }
    ctx.globalAlpha = 1;
  }

  /** trendの糸：エッジ沿いの微かなフィラメント。音の山（peakBoost）で一瞬だけ明瞭に */
  private drawFilaments(ctx: CanvasRenderingContext2D, t: number, trend: number): void {
    const alpha = Math.min(
      FILAMENT_ALPHA_CAP,
      this.fade * trend * (0.04 + 0.12 * visualizerBus.mid + this.peakBoost),
    );
    if (alpha < 0.005) return;

    const store = useHistoryStore.getState();
    if (store.edges.length === 0) return;
    const positionById = new Map<string, { x: number; y: number }>();
    for (const node of store.nodes) positionById.set(node.id, node.position);

    // 揺らぎの振幅：trendと中域で育ち、音の山でさらに膨らむ
    const amplitude =
      5 + 22 * trend + 14 * visualizerBus.mid + 10 * this.peakBoost;

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = 'rgb(120, 118, 118)';
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
        const sway =
          this.noise(s * 2.1 + t * 0.15, k * 7.7) * amplitude * Math.sin(s * Math.PI);
        ctx.lineTo(x0 + dx * s + nx * sway, y0 + dy * s + ny * sway);
      }
      ctx.stroke();
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

  /** 斑による粒の減光。absence→斑の数、中心ほど薄れ、burstで域が広がる */
  private voidDimAt(
    x: number,
    y: number,
    absence: number,
    burstMul: number,
    t: number,
  ): number {
    if (!this.voidSpots || absence <= 0) return 1;
    const activeSpots = Math.min(VOID_MAX, Math.max(1, Math.round(absence * VOID_MAX)));
    let dim = 1;
    for (let i = 0; i < activeSpots; i++) {
      const spot = this.voidSpots[i];
      // 半径はゆっくり呼吸（±15%）し、burstで一時的に広がる
      const breathing = 1 + 0.15 * this.noise(spot.seed, t * 0.05);
      const radius = spot.radius * breathing * burstMul;
      const distance = Math.hypot(x - spot.x, y - spot.y);
      if (distance >= radius) continue;
      const factor = distance / radius; // 0=中心, 1=縁
      dim *= VOID_CORE_DIM + (1 - VOID_CORE_DIM) * factor * factor;
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
