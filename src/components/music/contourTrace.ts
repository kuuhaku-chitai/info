/**
 * 空白地帯 - 輪郭抽出（記録の残像・純粋関数・AI不使用）
 *
 * 履歴画像のピクセルから「手書きで辿れる」折れ線群を取り出す。
 * グレースケール → Sobelエッジ → 強度の上位パーセンタイルで閾値 →
 * 貪欲な近傍連結でストロークに整理、という古典的な画像処理だけで作る。
 *
 * 出力は正規化座標（0-1）のストローク列。描画側（MemoryCanvas）が
 * world座標へ配置し、「段々と現れて、煙のように散る」演出を与える。
 *
 * 構造的な抑制（plan-visualizer-shapes.md §5）：
 * - ストローク最大8本・総点数最大600・短すぎる断片（<6点）は捨てる
 *   ——写真がどれだけノイズ質でも、描かれる量はこの箱を出られない
 * - 乱数を使わない完全な決定性（同じ画像→同じ輪郭）＝テスト可能
 */

export interface ContourPoint {
  /** 0-1（画像幅で正規化） */
  x: number;
  /** 0-1（画像高で正規化） */
  y: number;
}

export interface ContourStroke {
  points: ContourPoint[];
}

export interface ContourOptions {
  /** ストロークの最大本数 */
  maxStrokes?: number;
  /** 全ストローク合計の最大点数 */
  maxTotalPoints?: number;
  /** これ未満の断片は捨てる */
  minStrokePoints?: number;
}

const DEFAULTS: Required<ContourOptions> = {
  maxStrokes: 8,
  maxTotalPoints: 600,
  minStrokePoints: 6,
};

/** Sobel強度の閾値に使うパーセンタイル（上位20%だけがエッジになる） */
const EDGE_PERCENTILE = 0.8;

/** これ未満のSobel強度はノイズとして最初から捨てる */
const MAGNITUDE_FLOOR = 24;

/** RGBA → 輝度（0-255） */
function toGrayscale(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const o = i * 4;
    gray[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return gray;
}

/** Sobel勾配の大きさ（境界1pxは0のまま） */
function sobelMagnitude(
  gray: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const tl = gray[i - width - 1];
      const t = gray[i - width];
      const tr = gray[i - width + 1];
      const l = gray[i - 1];
      const r = gray[i + 1];
      const bl = gray[i + width - 1];
      const b = gray[i + width];
      const br = gray[i + width + 1];
      const gx = tr + 2 * r + br - (tl + 2 * l + bl);
      const gy = bl + 2 * b + br - (tl + 2 * t + tr);
      mag[i] = Math.hypot(gx, gy);
    }
  }
  return mag;
}

/** 強度分布の上位パーセンタイルを閾値にする（写真ごとの明暗差に自動追従） */
function adaptiveThreshold(mag: Float32Array): number {
  const candidates: number[] = [];
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] > MAGNITUDE_FLOOR) candidates.push(mag[i]);
  }
  if (candidates.length === 0) return Infinity;
  candidates.sort(function ascending(a, b) { return a - b; });
  return candidates[Math.floor(candidates.length * EDGE_PERCENTILE)];
}

/**
 * エッジ画素を貪欲に連結してストロークへ。
 * 行順走査で始点を選び、3×3→5×5の近傍から未使用のエッジ画素を辿る。
 * 固定の探索順＝決定的。
 */
function chainStrokes(
  isEdge: Uint8Array,
  width: number,
  height: number,
  options: Required<ContourOptions>,
): Array<Array<{ x: number; y: number }>> {
  const visited = new Uint8Array(width * height);
  const strokes: Array<Array<{ x: number; y: number }>> = [];

  function findNext(cx: number, cy: number): { x: number; y: number } | null {
    // 3×3 → 5×5 の順で最も近い未使用エッジを探す（順序固定）
    for (const radius of [1, 2]) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx === 0 && dy === 0) continue;
          // 外側リングのみ（内側は前の半径で走査済み）
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const ni = ny * width + nx;
          if (isEdge[ni] && !visited[ni]) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const start = y * width + x;
      if (!isEdge[start] || visited[start]) continue;

      const stroke: Array<{ x: number; y: number }> = [];
      let cx = x;
      let cy = y;
      visited[start] = 1;
      stroke.push({ x: cx, y: cy });
      let next = findNext(cx, cy);
      while (next) {
        visited[next.y * width + next.x] = 1;
        stroke.push(next);
        cx = next.x;
        cy = next.y;
        next = findNext(cx, cy);
      }
      if (stroke.length >= options.minStrokePoints) {
        strokes.push(stroke);
      }
    }
  }
  return strokes;
}

/**
 * RGBA画素 → 輪郭ストローク列（正規化座標）。このモジュールの入口。
 * エッジが無い画像（真っ白など）は空配列——残像は現れない。それも空白。
 */
export function traceContours(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  opts: ContourOptions = {},
): ContourStroke[] {
  if (width < 8 || height < 8 || rgba.length < width * height * 4) return [];
  const options = { ...DEFAULTS, ...opts };

  const gray = toGrayscale(rgba, width, height);
  const mag = sobelMagnitude(gray, width, height);
  const threshold = adaptiveThreshold(mag);
  if (!Number.isFinite(threshold)) return [];

  const isEdge = new Uint8Array(width * height);
  for (let i = 0; i < mag.length; i++) {
    if (mag[i] >= threshold) isEdge[i] = 1;
  }

  const raw = chainStrokes(isEdge, width, height, options);
  // 長い（＝輪郭らしい）ストロークを優先。同長は発見順＝決定的
  raw.sort(function byLengthDesc(a, b) { return b.length - a.length; });

  const result: ContourStroke[] = [];
  let totalPoints = 0;
  for (const stroke of raw) {
    if (result.length >= options.maxStrokes) break;
    const budget = options.maxTotalPoints - totalPoints;
    if (budget < options.minStrokePoints) break;
    const points = stroke.slice(0, budget).map(function normalize(p): ContourPoint {
      return { x: p.x / width, y: p.y / height };
    });
    result.push({ points });
    totalPoints += points.length;
  }
  return result;
}
