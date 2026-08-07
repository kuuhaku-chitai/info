/* 演奏intent（傾き・間・揺らぎ）の検証 */
import { buildMixPlan, neutralIntent } from '../../src/components/music/ensembleRules.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

const state = { density: 0.4, trend: 0.3, branchActivity: 0.5, mergeDensity: 0.2, stillness: 0.2, absence: 0, recordCount: 10, keywords: [], computedAt: '' } as never;

const plain = buildMixPlan(state, 12, 3);
const neutral = buildMixPlan(state, 12, 3, neutralIntent());
assert(JSON.stringify(plain) === JSON.stringify(neutral), '中立intent === intentなし');

const it = neutralIntent();
it.layers.atmosphere = 0;
assert(buildMixPlan(state, 12, 3, it).targets.find(t => t.role === 'atmosphere')!.gain === 0, '層0 → その層は沈黙');
it.layers.atmosphere = 1;
const lifted = buildMixPlan(state, 12, 3, it);
const plainAtmo = plain.targets.find(t => t.role === 'atmosphere')!.gain;
const liftedAtmo = lifted.targets.find(t => t.role === 'atmosphere')!.gain;
assert(liftedAtmo > plainAtmo && liftedAtmo <= 1, `層1 → 前へ出るが1.0以下 (${plainAtmo} → ${liftedAtmo})`);

const deep = neutralIntent(); deep.ma = 1;
const deepPlan = buildMixPlan(state, 12, 3, deep);
assert(deepPlan.targets.filter(t => t.resting).length === 2, '間=1 → base1+1=2層が休む');
const quietState = { ...(state as object), stillness: 0.8 } as never;
assert(buildMixPlan(quietState, 12, 3, deep).targets.filter(t => t.resting).length === 3, '静かな空間×間=1 → 3層（空気だけが残る）');
const shallow = neutralIntent(); shallow.ma = 0;
const shallowPlan = buildMixPlan(state, 12, 3, shallow);
assert(shallowPlan.targets.filter(t => t.resting).length === 1, '間=0でも最低1層は休む（原則を破れない）');

assert(deepPlan.masterGain < plain.masterGain, '深い間 → 全体が沈む');
assert(shallowPlan.masterGain <= 0.5, '間=0でもmaster絶対上限0.5を超えない');
const loudState = { ...(state as object), stillness: 0 } as never;
assert(buildMixPlan(loudState, 12, 3, shallow).masterGain <= 0.5, 'stillness=0×間=0でも0.5を超えない（空白は殺せない）');

const wavy = neutralIntent(); wavy.yuragi = 1;
const still = neutralIntent(); still.yuragi = 0;
const wavyDepth = buildMixPlan(state, 12, 3, wavy).targets[0].lfo.depth;
const stillDepth = buildMixPlan(state, 12, 3, still).targets[0].lfo.depth;
const plainDepth = plain.targets[0].lfo.depth;
assert(Math.abs(wavyDepth - plainDepth * 1.6) < 0.001, `揺らぎ1 → 深さ×1.6 (${wavyDepth})`);
assert(Math.abs(stillDepth - plainDepth * 0.4) < 0.001 && stillDepth > 0, `揺らぎ0 → 深さ×0.4・ゼロにはしない (${stillDepth})`);

assert(JSON.stringify(buildMixPlan(state, 12, 3, deep)) === JSON.stringify(deepPlan), '同じ入力→同じ計画（決定的）');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
