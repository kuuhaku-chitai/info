/* chapterRules（記憶の地層：章・風化・時刻の共鳴）の検証 */
import {
  buildChapterPlan, weatheringGain, weatheringLowpassHz, CHAPTER_CYCLE_SEC,
} from '../../src/components/music/chapterRules.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

const NOW = new Date('2026-07-15T09:00:00+09:00'); // JST朝9時

function gen(id: string, daysAgo: number, jstHour: number) {
  const base = new Date('2026-07-15T00:00:00+09:00').getTime() - daysAgo * 86400000;
  return { id, createdAt: new Date(base + jstHour * 3600000).toISOString() };
}

assert(buildChapterPlan([], NOW, 0).generationId === null, '過去世代なし → 沈黙の章');
let silent = 0;
for (let c = 0; c < 200; c++) {
  if (buildChapterPlan([gen('g1', 10, 8)], NOW, c).generationId === null) silent++;
}
assert(silent > 25 && silent < 75, `沈黙の章は約25% (${silent}/200)`);

const gens = [gen('morning-old', 40, 7), gen('night-new', 2, 23), gen('morning-new', 3, 8)];
const p1 = buildChapterPlan(gens, NOW, 5);
assert(JSON.stringify(p1) === JSON.stringify(buildChapterPlan(gens, NOW, 5)), '同じ章番号 → 同じ計画（決定的）');

const picked = new Set<string>();
for (let c = 0; c < 100; c++) {
  const p = buildChapterPlan(gens, NOW, c);
  if (p.generationId) picked.add(p.generationId);
}
assert(picked.has('morning-old') && picked.has('morning-new'), '朝の記憶が浮かぶ（輪番で両方）');
assert(!picked.has('night-new'), '夜採取の記憶は朝には浮かばない');

const nightOnly = [gen('n1', 5, 22), gen('n2', 10, 2)];
const fallbackPicked = new Set<string>();
for (let c = 0; c < 100; c++) {
  const p = buildChapterPlan(nightOnly, NOW, c);
  if (p.generationId) fallbackPicked.add(p.generationId);
}
assert(fallbackPicked.size === 2, '共鳴候補ゼロ → 全世代へフォールバック');

assert(weatheringGain(0) === 0.5, '採取直後 → 0.5（現在の半分より前に出ない）');
assert(weatheringGain(30) === 0.25, '30日 → 半減0.25');
assert(weatheringGain(365) === 0.15, '1年 → 下限0.15で消えない');
assert(weatheringLowpassHz(0) === 8000 && weatheringLowpassHz(30) === 4600, 'ローパス: 0日8000Hz / 30日4600Hz');
assert(weatheringLowpassHz(10000) >= 1200, 'ローパス下限1200Hz');

const oldOnly = [gen('old', 40, 8)];
let oldPlan: ReturnType<typeof buildChapterPlan> | null = null;
for (let c = 0; c < 50 && !oldPlan?.generationId; c++) oldPlan = buildChapterPlan(oldOnly, NOW, c);
assert(!!oldPlan?.generationId && oldPlan.gainMul < 0.25 && oldPlan.gainMul >= 0.15, `40日前 → gainMul ${oldPlan?.gainMul}`);
assert(!!oldPlan && oldPlan.lowpassHz < 4600, `40日前 → こもる (${oldPlan?.lowpassHz}Hz)`);

for (let c = 0; c < 60; c++) {
  const p = buildChapterPlan(gens, NOW, c);
  if (!p.generationId) continue;
  assert2(p.roles.length === 2, '滲む層は2つ');
  assert2(!p.roles.includes('atmosphere' as never), 'atmosphereは滲まない');
  assert2(p.surfaceProbability === 0.4, '出現確率0.4（承認値）');
}
function assert2(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } }
console.log('ok: 全章で 層2つ・atmosphere除外・確率0.4');
assert(CHAPTER_CYCLE_SEC === 300, '章は5分');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
