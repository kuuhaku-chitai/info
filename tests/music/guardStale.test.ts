/* 生成ロックの孤児化（stale）判定とガード連携の検証 */
import {
  evaluateGenerationRequest,
  isGenerationLockStale,
  STALE_LOCK_MS,
} from '../../src/lib/music/guard.ts';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg);
}

const now = new Date('2026-08-07T00:00:00.000Z');

// --- isGenerationLockStale ---
const fresh = new Date(now.getTime() - 1000).toISOString();
assert(!isGenerationLockStale(fresh, now), '直近のロックは孤児でない');

const justUnder = new Date(now.getTime() - (STALE_LOCK_MS - 1000)).toISOString();
assert(!isGenerationLockStale(justUnder, now), '閾値の少し手前は孤児でない');

const atThreshold = new Date(now.getTime() - STALE_LOCK_MS).toISOString();
assert(isGenerationLockStale(atThreshold, now), '閾値ちょうどで孤児');

const old = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
assert(isGenerationLockStale(old, now), '3日前のロックは孤児（今回の詰まりの再現）');

assert(isGenerationLockStale('壊れた時刻', now), '読めない時刻は孤児として復旧を優先');

// --- ガードとの連携：孤児ロックを外した値を渡せば手動再構築は通る ---
const stuck = {
  mode: 'manual' as const,
  updatedAt: old,
  isGenerating: true,
};
const lockStale = stuck.isGenerating && isGenerationLockStale(stuck.updatedAt, now);
const decision = evaluateGenerationRequest({
  mode: stuck.mode,
  isGenerating: stuck.isGenerating && !lockStale,
  todaySuccessCount: 0,
  trigger: 'manual',
});
assert(decision.allowed === true, '孤児ロック時、手動Rebuildは許可される');

// 生きたロック（新しい）はちゃんと二重生成を弾く
const liveStale = true && isGenerationLockStale(fresh, now);
const liveDecision = evaluateGenerationRequest({
  mode: 'manual',
  isGenerating: true && !liveStale,
  todaySuccessCount: 0,
  trigger: 'manual',
});
assert(liveDecision.allowed === false, '生きたロックは二重生成を弾く');

console.log(failed === 0 ? 'PASS' : `${failed} 件失敗`);
process.exit(failed === 0 ? 0 : 1);
