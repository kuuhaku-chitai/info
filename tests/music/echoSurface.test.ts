/* echo滲出（ゲイン・判定の交差・決定性）の検証 */
import { echoSurfaceGain, neutralIntent } from '../../src/components/music/ensembleRules.ts';
import { decideEchoSurfacing, type EchoPlan } from '../../src/components/music/chapterRules.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

// --- echoSurfaceGain：風化×現在の基礎値×層の傾き ---
assert(Math.abs(echoSurfaceGain('rhythm', 0.5, null) - 0.175) < 1e-9, 'rhythm: 0.35×0.5=0.175');
assert(Math.abs(echoSurfaceGain('melody', 0.15, null) - 0.068) < 1e-3, 'melody: 0.45×0.15≈0.068（風化下限）');
const zeroLayer = neutralIntent(); zeroLayer.layers.rhythm = 0;
assert(echoSurfaceGain('rhythm', 0.5, zeroLayer) === 0, '層の傾き0 → echoも0（intentはechoにも効く）');
const fullLayer = neutralIntent(); fullLayer.layers.rhythm = 1;
assert(Math.abs(echoSurfaceGain('rhythm', 0.5, fullLayer) - 0.35) < 1e-3, '層の傾き1 → 2倍（それでも現在の基礎値どまり）');

// --- decideEchoSurfacing：休止×章roles×確率の交差 ---
const plan: EchoPlan = { generationId: 'g1', roles: ['rhythm', 'melody'], gainMul: 0.4, lowpassHz: 6000, surfaceProbability: 1 };
const all = decideEchoSurfacing(plan, ['rhythm', 'melody', 'bass'], 1);
assert(all.length === 2 && all.includes('rhythm') && all.includes('melody'), '確率1×両方休止 → 両方滲む');
assert(decideEchoSurfacing(plan, ['bass'], 1).length === 0, '章のrolesが休んでいなければ滲まない');
assert(decideEchoSurfacing({ ...plan, generationId: null }, ['rhythm'], 1).length === 0, '沈黙の章は滲まない');
assert(decideEchoSurfacing({ ...plan, surfaceProbability: 0 }, ['rhythm'], 1).length === 0, '確率0は滲まない');

// 決定性：同じ周期番号 → 同じ判定
const p04: EchoPlan = { ...plan, surfaceProbability: 0.4 };
for (let c = 0; c < 10; c++) {
  const a = decideEchoSurfacing(p04, ['rhythm', 'melody'], c);
  const b = decideEchoSurfacing(p04, ['rhythm', 'melody'], c);
  if (JSON.stringify(a) !== JSON.stringify(b)) { console.error('FAIL: 決定性'); failed++; break; }
}
console.log('ok: 同じ周期 → 同じ判定（決定的）');

// 確率0.4が実効として現れる
let count = 0;
for (let c = 0; c < 1000; c++) count += decideEchoSurfacing(p04, ['rhythm', 'melody'], c).length;
const rate = count / 2000;
assert(rate > 0.32 && rate < 0.48, `滲出率≈0.4 (実測${rate.toFixed(3)})`);

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
