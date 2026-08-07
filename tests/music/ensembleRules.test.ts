/* ensembleRules（ミックス計画）の検証 */
import { buildMixPlan, BREATH_CYCLE_SEC } from '../../src/components/music/ensembleRules.ts';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); failed++; }
  else console.log('ok:', msg);
}

const calmState = {
  density: 0.4, trend: 0.3, branchActivity: 0.5, mergeDensity: 0.2,
  stillness: 0.2, absence: 0, recordCount: 10, keywords: [], computedAt: '',
};

const plan = buildMixPlan(calmState as never, 12, 0);
assert(plan.targets.length === 4, '4 stems分のターゲット');
assert(plan.targets.filter(t => t.resting).length === 1, '平常時は1 stemが休む');
assert(!plan.targets.find(t => t.role === 'atmosphere')!.resting, 'atmosphereは休まない');
assert(plan.targets.every(t => t.gain >= 0 && t.gain <= 1), 'ゲインは0-1');
assert(plan.masterGain <= 0.5, 'マスターは0.5以下（微弱）');
assert(plan.rampSec >= 10, 'ランプは10秒以上（急な変化なし）');
assert(plan.silenceBurst === null, 'absence=0なら無音バーストなし');

const plan2 = buildMixPlan(calmState as never, 12, 0);
assert(JSON.stringify(plan) === JSON.stringify(plan2), '同じ入力→同じ計画（決定的）');

const restRoles = new Set<string>();
for (let c = 0; c < 12; c++) {
  buildMixPlan(calmState as never, 12, c).targets.forEach(t => { if (t.resting) restRoles.add(t.role); });
}
assert(restRoles.size === 3 && !restRoles.has('atmosphere'), `休みは3役割を巡る (${[...restRoles].join(',')})`);

assert(buildMixPlan({ ...calmState, absence: 0.5 } as never, 12, 1).targets.filter(t => t.resting).length === 2, 'absence>0.3 → 2 stems休止');
assert(buildMixPlan({ ...calmState, stillness: 0.8 } as never, 12, 1).targets.filter(t => t.resting).length === 2, 'stillness>0.6 → 2 stems休止');

let bursts = 0;
for (let c = 0; c < 50; c++) {
  const p = buildMixPlan({ ...calmState, absence: 0.8 } as never, 12, c);
  if (p.silenceBurst) {
    bursts++;
    assert2(p.silenceBurst.delaySec + p.silenceBurst.durationSec < BREATH_CYCLE_SEC, 'バーストは周期内');
    assert2(p.silenceBurst.durationSec <= 3, 'バーストは3秒以下（一瞬）');
  }
}
function assert2(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } }
assert(bursts > 10 && bursts < 40, `absence=0.8で50周期中${bursts}回のバースト（確率的・過剰でない）`);

const deepStill = buildMixPlan({ ...calmState, stillness: 1 } as never, 12, 0);
assert(deepStill.masterGain < plan.masterGain, 'stillnessが深いほど沈む');
assert(deepStill.masterGain > 0, '完全な無音にはしない');

const night = buildMixPlan(calmState as never, 2, 0);
assert(night.masterGain < plan.masterGain, '夜は昼より沈む');
const morning = buildMixPlan(calmState as never, 7, 3);
const noonSame = buildMixPlan(calmState as never, 12, 3);
const mMel = morning.targets.find(t => t.role === 'melody')!;
const nMel = noonSame.targets.find(t => t.role === 'melody')!;
if (!mMel.resting) assert(mMel.gain > nMel.gain, '朝は旋律がわずかに目覚める');

const nullPlan = buildMixPlan(null, 12, 0);
assert(nullPlan.targets.length === 4 && nullPlan.masterGain > 0, 'MusicState無しでも既定値で鳴る');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
