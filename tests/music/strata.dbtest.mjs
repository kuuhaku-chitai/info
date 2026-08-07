/* 記憶の地層：getRecentGenerationsWithStemsの実DB検証。
   実行前の現行世代を退避し、後始末で必ず復元する（実データを汚さない） */
process.env.CLOUDFLARE_D1_API_TOKEN = '';
const {
  insertGenerationLog, replaceCurrentStems, getRecentGenerationsWithStems,
} = await import('../../src/lib/music/musicDb.ts');
const { execute, query } = await import('../../src/lib/db.ts');

let failed = 0;
function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); failed++; } else console.log('ok:', msg); }

const run = Date.now().toString(36);
const genIds = [];
const beforeCurrent = (await query('SELECT DISTINCT generation_id FROM music_stems WHERE is_current = 1')).map((r) => r.generation_id);

try {
  for (let i = 0; i < 3; i++) {
    const id = `strata-${run}-${i}`;
    genIds.push(id);
    await insertGenerationLog({ id, triggerType: 'manual', status: 'started' });
    const created = new Date(Date.now() - (2 - i) * 86400000).toISOString();
    await execute("UPDATE music_generation_log SET status = 'success', created_at = ? WHERE id = ?", [created, id]);
    await replaceCurrentStems(id, ['rhythm', 'bass', 'melody', 'atmosphere'].map((role) => ({
      id: `stem-${run}-${i}-${role}`,
      stemRole: role,
      r2Key: `music/stems/${id}/${role}.wav`,
      url: `https://example.com/${id}/${role}.wav`,
      durationSec: 48,
    })));
  }

  const strata = await getRecentGenerationsWithStems(8);
  const mine = strata.filter((g) => g.id.startsWith(`strata-${run}`));
  assert(mine.length === 3, `3世代が返る (${mine.length})`);
  assert(mine[0].id === genIds[2] && mine[2].id === genIds[0], '新しい順に並ぶ');
  assert(mine.every((g) => g.stems.length === 4), '各世代に4 stems');
  assert(mine[0].stems[0].stemRole === 'rhythm' && mine[0].stems[3].stemRole === 'atmosphere', 'stem役割順が安定');
  assert(mine[0].stems.every((s) => s.generationId === mine[0].id), 'stemsは正しい世代に束ねられる');
  const limited = await getRecentGenerationsWithStems(2);
  assert(limited.length <= 2, `limitが効く (${limited.length})`);
} finally {
  await execute(`DELETE FROM music_stems WHERE id LIKE 'stem-${run}%'`, []);
  await execute(`DELETE FROM music_generation_log WHERE id LIKE 'strata-${run}%'`, []);
  for (const gid of beforeCurrent) {
    await execute('UPDATE music_stems SET is_current = 1 WHERE generation_id = ?', [gid]);
  }
}
const after = await getRecentGenerationsWithStems(8);
assert(!after.some((g) => g.id.startsWith(`strata-${run}`)), 'シードの掃除完了');

console.log(failed === 0 ? '全テスト成功' : `${failed}件失敗`);
process.exit(failed === 0 ? 0 : 1);
