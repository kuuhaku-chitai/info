/* splitBands（帯域分割）の検証。mid×1.15/high×1.1は調律済みブースト係数 */
import { splitBands } from '../../src/components/music/visualizerBus.ts';
let failed = 0;
function assert(cond: boolean, msg: string) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

assert(JSON.stringify(splitBands(new Uint8Array(0))) === JSON.stringify({ level: 0, low: 0, mid: 0, high: 0 }), '空 → 全0');

const silencio = new Uint8Array(128);
const s = splitBands(silencio);
assert(s.level === 0 && s.low === 0 && s.mid === 0 && s.high === 0, '無音 → 全0');

const fullData = new Uint8Array(128).fill(255);
const full = splitBands(fullData);
assert(full.level === 1 && full.low === 1 && Math.abs(full.mid - 1.15) < 1e-9 && Math.abs(full.high - 1.1) < 1e-9,
  '全開 → low/level=1・mid=1.15・high=1.1（ブースト係数込み）');

const lowOnly = new Uint8Array(128);
for (let i = 0; i < 4; i++) lowOnly[i] = 255;
const lo = splitBands(lowOnly);
assert(lo.low === 1 && lo.mid === 0 && lo.high === 0, '低域のみ → low=1');

const midOnly = new Uint8Array(128);
for (let i = 4; i < 22; i++) midOnly[i] = 255;
const mi = splitBands(midOnly);
assert(Math.abs(mi.mid - 1.15) < 1e-9 && mi.low === 0 && mi.high === 0, '中域のみ → mid=1.15（ブースト込み）');

const highOnly = new Uint8Array(128);
for (let i = 22; i < 128; i++) highOnly[i] = 128;
const hi = splitBands(highOnly);
assert(Math.abs(hi.high - (128 / 255) * 1.1) < 1e-9 && hi.low === 0 && hi.mid === 0, '高域のみ → high≈0.55（ブースト込み）');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
