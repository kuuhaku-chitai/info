/* 保持方針（案A：直近30世代）：pruneOldGenerationsの実DB検証。
   シードは実データより古い日付（2026-01）にする＝剪定はシードだけを消し、
   実世代（新しい）は構造的に守られる。後始末で残シード削除＋is_current復元 */
process.env.CLOUDFLARE_D1_API_TOKEN = '';
const { insertGenerationLog, replaceCurrentStems } = await import('../../src/lib/music/musicDb.ts');
const { pruneOldGenerations, RETAIN_GENERATIONS } = await import('../../src/lib/music/retention.ts');
const { execute, query, queryOne } = await import('../../src/lib/db.ts');

let failed = 0;
function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

const run = Date.now().toString(36);
const SEED_COUNT = 35;
const beforeCurrent = (await query('SELECT DISTINCT generation_id FROM music_stems WHERE is_current = 1')).map((r) => r.generation_id);
const realSuccessBefore = (await queryOne("SELECT COUNT(*) AS c FROM music_generation_log WHERE status = 'success'")).c;

try {
  // 実データより古い成功世代を35件シード（2026-01-01から1時間刻み）
  for (let i = 0; i < SEED_COUNT; i++) {
    const id = `ret-${run}-${String(i).padStart(2, '0')}`;
    await insertGenerationLog({ id, triggerType: 'manual', status: 'started' });
    const created = new Date(Date.parse('2026-01-01T00:00:00Z') + i * 3600000).toISOString();
    await execute("UPDATE music_generation_log SET status = 'success', created_at = ? WHERE id = ?", [created, id]);
    await replaceCurrentStems(id, [{
      id: `retstem-${run}-${i}`,
      stemRole: 'rhythm',
      r2Key: `music/stems/${id}/rhythm.wav`,
      url: `https://example.com/${id}/rhythm.wav`,
      durationSec: 48,
    }]);
  }

  const totalBefore = realSuccessBefore + SEED_COUNT;
  const expectPruned = Math.max(0, totalBefore - RETAIN_GENERATIONS);
  const result = await pruneOldGenerations();
  console.log(`剪定結果: ${JSON.stringify(result)}（総${totalBefore}世代 → 保持${RETAIN_GENERATIONS}）`);
  assert(result.prunedGenerations === expectPruned, `超過分だけ消える (期待${expectPruned}/実際${result.prunedGenerations})`);
  assert(result.carriedOver === 0, '持ち越しなし（R2削除は冪等に成功）');

  const successAfter = (await queryOne("SELECT COUNT(*) AS c FROM music_generation_log WHERE status = 'success'")).c;
  assert(successAfter === Math.min(totalBefore, RETAIN_GENERATIONS), `成功世代が保持数まで減る (${successAfter})`);

  // 消えたのは最古（シードの先頭側）で、実世代（新しい）は無傷
  const realAfter = (await queryOne("SELECT COUNT(*) AS c FROM music_generation_log WHERE status = 'success' AND id NOT LIKE ?", [`ret-${run}%`])).c;
  assert(realAfter === realSuccessBefore, '実世代は1つも消えていない');
  const oldest = await queryOne(`SELECT id FROM music_generation_log WHERE id LIKE 'ret-${run}-00'`);
  assert(!oldest, '最古のシードが消えている');

  // 冪等：2回目は何も消えない
  const second = await pruneOldGenerations();
  assert(second.prunedGenerations === 0, '2回目の剪定は何も消さない（冪等）');
} finally {
  await execute(`DELETE FROM music_stems WHERE id LIKE 'retstem-${run}%'`, []);
  await execute(`DELETE FROM music_generation_log WHERE id LIKE 'ret-${run}%'`, []);
  for (const gid of beforeCurrent) {
    await execute('UPDATE music_stems SET is_current = 1 WHERE generation_id = ?', [gid]);
  }
}
const leftover = (await queryOne(`SELECT COUNT(*) AS c FROM music_generation_log WHERE id LIKE 'ret-${run}%'`)).c;
assert(leftover === 0, 'シードの掃除完了');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
