/* 「間」→ 滲出確率の連動テスト */
import { decideEchoSurfacing, type EchoPlan } from '../../src/components/music/chapterRules.ts';
import { echoProbabilityMultiplier, neutralIntent } from '../../src/components/music/ensembleRules.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

assert(echoProbabilityMultiplier(null) === 1, 'intentなし → 等倍');
assert(echoProbabilityMultiplier(neutralIntent()) === 1, '中立 → 等倍');
const deepMa = neutralIntent(); deepMa.ma = 1;
const shallowMa = neutralIntent(); shallowMa.ma = 0;
assert(echoProbabilityMultiplier(deepMa) === 0.6, '間=1 → ×0.6（記憶も浮かびにくく）');
assert(echoProbabilityMultiplier(shallowMa) === 1.4, '間=0 → ×1.4（わずかに浮かびやすく）');

const plan: EchoPlan = { generationId: 'g1', roles: ['rhythm', 'melody'], gainMul: 0.4, lowpassHz: 6000, surfaceProbability: 0.4 };
let deepCount = 0, neutralCount = 0, shallowCount = 0;
for (let c = 0; c < 1000; c++) {
  deepCount += decideEchoSurfacing(plan, ['rhythm', 'melody'], c, 0.6).length;
  neutralCount += decideEchoSurfacing(plan, ['rhythm', 'melody'], c, 1).length;
  shallowCount += decideEchoSurfacing(plan, ['rhythm', 'melody'], c, 1.4).length;
}
const dr = deepCount / 2000, nr = neutralCount / 2000, sr = shallowCount / 2000;
assert(dr < nr && nr < sr, `単調性: 深い間ほど滲まない (${dr.toFixed(3)} < ${nr.toFixed(3)} < ${sr.toFixed(3)})`);
assert(dr > 0.19 && dr < 0.29, `間=1で実効≒0.24 (${dr.toFixed(3)})`);
assert(sr > 0.51 && sr < 0.61, `間=0で実効≒0.56 (${sr.toFixed(3)})`);
const over = decideEchoSurfacing({ ...plan, surfaceProbability: 0.9 }, ['rhythm', 'melody'], 1, 5);
assert(over.length <= 2, '確率は1でclampされ全滲出どまり');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
