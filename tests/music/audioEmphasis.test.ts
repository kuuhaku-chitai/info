/* 音の強調版（master強調項・lowpass・大変容・echo boost）と不変条件の証明 */
import {
  buildMixPlan, neutralIntent, echoSurfaceGain, masterLowpassHz, isMajorTransformation,
} from '../../src/components/music/ensembleRules.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

const base = { density: 0.4, trend: 0.3, branchActivity: 0.5, mergeDensity: 0.2, stillness: 0.2, absence: 0, recordCount: 10, keywords: [], computedAt: '' };
const S = (over: object) => ({ ...base, ...over }) as never;

// ===== 1. master強調項 =====
const calm = buildMixPlan(S({ trend: 0, density: 0.4 }), 12, 3);
const lively = buildMixPlan(S({ trend: 1, density: 1 }), 12, 3);
assert(lively.masterGain > calm.masterGain, `活発な空間で明確に持ち上がる (${calm.masterGain} → ${lively.masterGain})`);
assert(lively.masterGain <= 0.5, `絶対上限0.5は不変 (${lively.masterGain})`);
let maxSeen = 0;
for (const trend of [0, 0.5, 1]) for (const density of [0, 0.5, 1])
for (const stillness of [0, 1]) for (const hour of [7, 12, 19, 2])
for (const ma of [0, 0.5, 1]) {
  const it = neutralIntent(); it.ma = ma;
  const p = buildMixPlan(S({ trend, density, stillness }), hour, 1, it);
  if (p.masterGain > maxSeen) maxSeen = p.masterGain;
}
assert(maxSeen <= 0.5, `総当たり324条件でもmaster≤0.5 (最大${maxSeen})`);
assert(Math.abs(lively.masterGain - Math.min(0.5, calm.masterGain * 1.25)) < 0.01, '強調は最大+25%');

// ===== 2. lowpass写像 =====
assert(masterLowpassHz(S({ stillness: 0, absence: 0 })) === 20000, '静けさゼロ → 20kHz＝素通し');
assert(masterLowpassHz(S({ stillness: 1, absence: 1 })) === 3000, '最深 → 下限3kHz');
const shallowHz = masterLowpassHz(S({ stillness: 0.3, absence: 0 }));
const deepHz = masterLowpassHz(S({ stillness: 0.9, absence: 0.5 }));
assert(shallowHz > deepHz && deepHz >= 3000, `深いほどこもる (${shallowHz}Hz → ${deepHz}Hz)`);

// ===== 3. 大変容の判定 =====
assert(!isMajorTransformation(null, S({})), '初回（prevなし）は変容ではない');
assert(!isMajorTransformation(S({}), null), 'nextなしも変容ではない');
assert(!isMajorTransformation(S({ trend: 0.3 }), S({ trend: 0.5 })), '小さな変化は出来事にならない (Δ0.2)');
assert(isMajorTransformation(S({ trend: 0.1 }), S({ trend: 0.6 })), 'trendの跳躍は出来事 (Δ0.5)');
assert(isMajorTransformation(S({ absence: 0 }), S({ absence: 0.4 })), '欠落の出現も出来事 (Δ0.4)');
assert(isMajorTransformation(S({ trend: 0.2, absence: 0 }), S({ trend: 0.45, absence: 0.2 })), '合算でも判定 (Δ0.45)');

// ===== 4. echo boost =====
assert(Math.abs(echoSurfaceGain('rhythm', 0.5, null, 1) - 0.175) < 1e-9, '通常: 0.35×0.5');
assert(Math.abs(echoSurfaceGain('rhythm', 0.5, null, 1.5) - 0.2625) < 0.001, 'boost: 0.35×0.75（風化×1.5）');
assert(Math.abs(echoSurfaceGain('rhythm', 0.5, null, 10) - 0.35) < 1e-9, '極端なboostでも基礎値0.35が天井');
const it = neutralIntent(); it.layers.rhythm = 1;
assert(echoSurfaceGain('rhythm', 0.5, it, 1.5) <= 0.7, '層の傾き併用でもclamp01内');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
