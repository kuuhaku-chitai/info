/* contourTrace（輪郭抽出）の検証 */
import { traceContours } from '../../src/components/music/contourTrace.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

function makeImage(w: number, h: number, paint: (x: number, y: number) => number): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = paint(x, y);
    const o = (y * w + x) * 4;
    rgba[o] = rgba[o + 1] = rgba[o + 2] = v;
    rgba[o + 3] = 255;
  }
  return rgba;
}

const square = makeImage(48, 48, (x, y) => {
  const onBorder = (x >= 12 && x <= 36 && y >= 12 && y <= 36) &&
    !(x >= 14 && x <= 34 && y >= 14 && y <= 34);
  return onBorder ? 0 : 255;
});
const sq = traceContours(square, 48, 48);
const sqPoints = sq.flatMap(s => s.points);
assert(sq.length >= 1, `矩形: ストロークが取れる (${sq.length}本)`);
assert(sqPoints.length >= 40, `矩形: 十分な点数 (${sqPoints.length}点)`);
assert(sqPoints.every(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1), '矩形: 座標は0-1に正規化');
const nearBorder = sqPoints.filter(p => {
  const px = p.x * 48, py = p.y * 48;
  return px >= 10 && px <= 38 && py >= 10 && py <= 38 && !(px > 16 && px < 32 && py > 16 && py < 32);
});
assert(nearBorder.length / sqPoints.length > 0.9, `矩形: 9割以上が枠線近傍`);

const circle = makeImage(64, 64, (x, y) => (Math.hypot(x - 32, y - 32) <= 20 ? 30 : 245));
const ci = traceContours(circle, 64, 64);
const ciPoints = ci.flatMap(s => s.points);
assert(ciPoints.length >= 40, `円: 十分な点数 (${ciPoints.length}点)`);
const onRing = ciPoints.filter(p => {
  const d = Math.hypot(p.x * 64 - 32, p.y * 64 - 32);
  return d >= 17 && d <= 23;
});
assert(onRing.length / ciPoints.length > 0.9, `円: 9割以上が円周近傍`);

assert(traceContours(makeImage(48, 48, () => 255), 48, 48).length === 0, '真っ白 → 輪郭なし（それも空白）');

const checker = makeImage(64, 64, (x, y) => ((x + y) % 2 === 0 ? 0 : 255));
const ch = traceContours(checker, 64, 64);
assert(ch.length <= 8, `市松: ストローク上限8 (${ch.length}本)`);
assert(ch.flatMap(s => s.points).length <= 600, '市松: 総点数上限600');

assert(JSON.stringify(traceContours(circle, 64, 64)) === JSON.stringify(ci), '同じ画像 → 同じ輪郭（決定的）');
assert(traceContours(new Uint8ClampedArray(10), 48, 48).length === 0, '短すぎるバッファ → 空');
assert(traceContours(square, 4, 4).length === 0, '小さすぎる画像 → 空');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
