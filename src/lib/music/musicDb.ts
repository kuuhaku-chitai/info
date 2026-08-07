/**
 * 空白地帯 - Music Mode 永続層（副作用モジュール）
 *
 * D1（本番）/ SQLite（開発）へのアクセスをここに隔離する。
 * 判定ロジック（guard.ts）と翻訳ロジック（memoryEngine.ts）は純粋関数のまま、
 * このモジュールだけが「読む・書く」を担う——副作用の境界を1ファイルに保つ。
 *
 * 既存db.tsのquery/queryOne/executeプリミティブを再利用し、
 * 接続管理・環境分岐のコードを重複させない（軽量化最優先）。
 */

import { query, queryOne, execute } from '@/lib/db';
import type {
  MusicSettings,
  MusicUpdateMode,
  MusicPromptTemplate,
  MusicGenerationLog,
  MusicGenerationStatus,
  MusicTriggerType,
  MusicState,
  MusicWeightedPrompt,
  MusicStem,
  GenerationStems,
  StemRole,
} from '@/types';

interface DbRow {
  [key: string]: unknown;
}

// ============================================
// 行 → 型 変換（名前付き関数）
// ============================================

function rowToMusicSettings(row: DbRow): MusicSettings {
  return {
    mode: row.mode as MusicUpdateMode,
    scheduleMorning: row.schedule_morning as string,
    scheduleNoon: row.schedule_noon as string,
    scheduleEvening: row.schedule_evening as string,
    isGenerating: Boolean(row.is_generating),
    updatedAt: row.updated_at as string,
  };
}

function rowToTemplate(row: DbRow): MusicPromptTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    stemRole: row.stem_role as StemRole,
    template: row.template as string,
    isActive: Boolean(row.is_active),
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToStem(row: DbRow): MusicStem {
  return {
    id: row.id as string,
    generationId: row.generation_id as string,
    stemRole: row.stem_role as StemRole,
    r2Key: row.r2_key as string,
    url: row.url as string,
    durationSec: row.duration_sec as number,
    isCurrent: Boolean(row.is_current),
    createdAt: row.created_at as string,
  };
}

/** JSON列を安全にパースする。壊れた記録は「無い」ものとして扱う */
function parseJsonColumn<T>(value: unknown): T | null {
  if (typeof value !== 'string' || value === '') return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function rowToGenerationLog(row: DbRow): MusicGenerationLog {
  return {
    id: row.id as string,
    triggerType: row.trigger_type as MusicTriggerType,
    status: row.status as MusicGenerationStatus,
    musicState: parseJsonColumn<MusicState>(row.music_state),
    prompts: parseJsonColumn<MusicWeightedPrompt[]>(row.prompts),
    error: (row.error as string) ?? undefined,
    durationMs: (row.duration_ms as number) ?? undefined,
    createdAt: row.created_at as string,
  };
}

// ============================================
// 設定（music_settings 単一行）
// ============================================

export async function getMusicSettings(): Promise<MusicSettings> {
  const row = await queryOne<DbRow>('SELECT * FROM music_settings WHERE id = 1');
  if (!row) {
    // マイグレーション済みなら必ず存在する。無い＝環境不備なので早期に落とす
    throw new Error('music_settings が初期化されていません（migration 0010 未適用）');
  }
  return rowToMusicSettings(row);
}

/**
 * 生成ロックの取得を試みる。
 * 「is_generating = 0、または孤児化した古いロック（updated_at < staleBeforeIso）の時だけ立てる」
 * 条件付きUPDATEの後、自分のスタンプ（ミリ秒精度のISO）が残っているか読み直して確認する
 * ——D1 REST越しでもトランザクション無しで競合を検出できる、最小の楽観ロック。
 *
 * staleBeforeIso より前のロックを奪い取れるのは、途中で落ちたWorkerが
 * finallyを走らせられずロックを取り残す事故から自己修復するため（guard.ts STALE_LOCK_MS）。
 *
 * @returns ロックを取得できたらtrue
 */
export async function acquireGenerationLock(
  lockStamp: string,
  staleBeforeIso: string,
): Promise<boolean> {
  await execute(
    `UPDATE music_settings SET is_generating = 1, updated_at = ?
     WHERE id = 1 AND (is_generating = 0 OR updated_at < ?)`,
    [lockStamp, staleBeforeIso],
  );
  const row = await queryOne<DbRow>(
    'SELECT updated_at FROM music_settings WHERE id = 1 AND is_generating = 1',
  );
  return row?.updated_at === lockStamp;
}

/** 生成ロックを解放する。生成の成否に関わらずfinallyで必ず呼ぶ */
export async function releaseGenerationLock(): Promise<void> {
  await execute(
    'UPDATE music_settings SET is_generating = 0, updated_at = ? WHERE id = 1',
    [new Date().toISOString()],
  );
}

/**
 * 更新モードの切り替え（管理画面から）。
 * この1行の書き換えが全セッションのAuto/Manualを決める。
 */
export async function updateMusicMode(mode: MusicUpdateMode): Promise<void> {
  await execute(
    'UPDATE music_settings SET mode = ?, updated_at = ? WHERE id = 1',
    [mode, new Date().toISOString()],
  );
}

/** Auto時の生成時刻（JST "HH:MM"）を更新する */
export async function updateMusicSchedule(
  morning: string,
  noon: string,
  evening: string,
): Promise<void> {
  await execute(
    `UPDATE music_settings
     SET schedule_morning = ?, schedule_noon = ?, schedule_evening = ?, updated_at = ?
     WHERE id = 1`,
    [morning, noon, evening, new Date().toISOString()],
  );
}

// ============================================
// 使用ログ（music_generation_log）
// ============================================

/** 当日（JST基準の開始時刻以降）の成功済み生成回数。1日3回上限のカウント根拠 */
export async function countTodaySuccess(sinceUtcIso: string): Promise<number> {
  const row = await queryOne<DbRow>(
    "SELECT COUNT(*) as cnt FROM music_generation_log WHERE status = 'success' AND created_at >= ?",
    [sinceUtcIso],
  );
  return (row?.cnt as number) ?? 0;
}

/** 生成ログを書き込む（started / skipped の初期記録） */
export async function insertGenerationLog(entry: {
  id: string;
  triggerType: MusicTriggerType;
  status: MusicGenerationStatus;
  musicState?: MusicState | null;
  prompts?: MusicWeightedPrompt[] | null;
  error?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO music_generation_log (id, trigger_type, status, music_state, prompts, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.id,
      entry.triggerType,
      entry.status,
      entry.musicState ? JSON.stringify(entry.musicState) : null,
      entry.prompts ? JSON.stringify(entry.prompts) : null,
      entry.error ?? null,
      new Date().toISOString(),
    ],
  );
}

/** 生成ログを完了状態へ更新する（success / failed） */
export async function finishGenerationLog(
  id: string,
  status: 'success' | 'failed',
  fields: { error?: string; durationMs?: number },
): Promise<void> {
  await execute(
    'UPDATE music_generation_log SET status = ?, error = ?, duration_ms = ? WHERE id = ?',
    [status, fields.error ?? null, fields.durationMs ?? null, id],
  );
}

/** 使用ログ一覧（管理画面用・新しい順） */
export async function getGenerationLogs(limit = 30): Promise<MusicGenerationLog[]> {
  const rows = await query<DbRow>(
    'SELECT * FROM music_generation_log ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map(rowToGenerationLog);
}

/**
 * 最後に成功した生成のMusicStateスナップショットを返す。
 * Memory Engineの欠落（absence）検知は、この「前回の記憶」との比較で行われる。
 */
export async function getLatestMusicState(): Promise<MusicState | null> {
  const row = await queryOne<DbRow>(
    "SELECT music_state FROM music_generation_log WHERE status = 'success' ORDER BY created_at DESC LIMIT 1",
  );
  return row ? parseJsonColumn<MusicState>(row.music_state) : null;
}

// ============================================
// プロンプトテンプレート（music_prompt_templates）
// ============================================

/** 有効テンプレート一覧（Memory Engineへの入力） */
export async function getActiveTemplates(): Promise<MusicPromptTemplate[]> {
  const rows = await query<DbRow>(
    'SELECT * FROM music_prompt_templates WHERE is_active = 1 ORDER BY sort_order ASC',
  );
  return rows.map(rowToTemplate);
}

/** 全テンプレート一覧（管理画面用。無効も含む） */
export async function getAllTemplates(): Promise<MusicPromptTemplate[]> {
  const rows = await query<DbRow>(
    'SELECT * FROM music_prompt_templates ORDER BY sort_order ASC, created_at ASC',
  );
  return rows.map(rowToTemplate);
}

export async function createTemplate(tpl: {
  id: string;
  name: string;
  stemRole: StemRole;
  template: string;
  sortOrder: number;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO music_prompt_templates (id, name, stem_role, template, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?, ?)`,
    [tpl.id, tpl.name, tpl.stemRole, tpl.template, tpl.sortOrder, now, now],
  );
}

export async function updateTemplate(
  id: string,
  fields: { name: string; template: string; isActive: boolean; sortOrder: number },
): Promise<void> {
  await execute(
    `UPDATE music_prompt_templates
     SET name = ?, template = ?, is_active = ?, sort_order = ?, updated_at = ?
     WHERE id = ?`,
    [fields.name, fields.template, fields.isActive ? 1 : 0, fields.sortOrder, new Date().toISOString(), id],
  );
}

export async function deleteTemplate(id: string): Promise<void> {
  await execute('DELETE FROM music_prompt_templates WHERE id = ?', [id]);
}

// ============================================
// stems（music_stems / 現行アンサンブルのmanifest）
// ============================================

/**
 * 新世代のstemsを登録し、現行アンサンブルを差し替える。
 * 挿入 → 旧世代のis_currentを落とす、の順にすることで、
 * 途中で落ちても「現行が空になる」瞬間を作らない（音は途切れない）。
 */
export async function replaceCurrentStems(
  generationId: string,
  stems: Array<{
    id: string;
    stemRole: StemRole;
    r2Key: string;
    url: string;
    durationSec: number;
  }>,
): Promise<void> {
  const now = new Date().toISOString();
  for (const stem of stems) {
    await execute(
      `INSERT INTO music_stems (id, generation_id, stem_role, r2_key, url, duration_sec, is_current, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [stem.id, generationId, stem.stemRole, stem.r2Key, stem.url, stem.durationSec, now],
    );
  }
  await execute(
    'UPDATE music_stems SET is_current = 0 WHERE generation_id != ? AND is_current = 1',
    [generationId],
  );
}

/** 現行アンサンブルのstems（役割順で安定させる） */
export async function getCurrentStems(): Promise<MusicStem[]> {
  const rows = await query<DbRow>(
    `SELECT * FROM music_stems WHERE is_current = 1
     ORDER BY CASE stem_role
       WHEN 'rhythm' THEN 0 WHEN 'bass' THEN 1 WHEN 'melody' THEN 2 ELSE 3 END`,
  );
  return rows.map(rowToStem);
}

/**
 * 保持方針（案A）：保持上限を超えた古い成功世代を返す。
 * 新しい順でkeep件をスキップした残り＝風化して消える候補。
 * 各世代のR2キーも添えて返す（呼び出し側がR2削除→D1削除の順で処理する）。
 */
export async function getPrunableGenerations(
  keep: number,
): Promise<Array<{ id: string; r2Keys: string[] }>> {
  const rows = await query<DbRow>(
    `SELECT id FROM music_generation_log
     WHERE status = 'success' ORDER BY created_at DESC LIMIT 100000 OFFSET ?`,
    [keep],
  );
  if (rows.length === 0) return [];

  const ids = rows.map(function pickId(r) { return r.id as string; });
  const placeholders = ids.map(function toPlaceholder() { return '?'; }).join(', ');
  const stemRows = await query<DbRow>(
    `SELECT generation_id, r2_key FROM music_stems WHERE generation_id IN (${placeholders})`,
    ids,
  );
  const keysByGeneration = new Map<string, string[]>();
  for (const row of stemRows) {
    const gid = row.generation_id as string;
    const bucket = keysByGeneration.get(gid);
    if (bucket) bucket.push(row.r2_key as string);
    else keysByGeneration.set(gid, [row.r2_key as string]);
  }
  return ids.map(function toPrunable(gid) {
    return { id: gid, r2Keys: keysByGeneration.get(gid) ?? [] };
  });
}

/**
 * 1世代分のD1行を削除する（stems → ログの順。
 * 外部キーのCASCADEはローカルSQLiteでは有効化されていないため明示的に消す）。
 * R2オブジェクトの削除が済んだ世代にだけ呼ぶこと。
 */
export async function deleteGenerationRows(generationId: string): Promise<void> {
  await execute('DELETE FROM music_stems WHERE generation_id = ?', [generationId]);
  await execute('DELETE FROM music_generation_log WHERE id = ?', [generationId]);
}

/**
 * 記憶の地層：直近N世代のstems一式（新しい順、現行世代を含む）。
 *
 * 「記憶の地層」計画の§2.1。過去世代はis_current=0になっても
 * D1とR2に残っている——それをmanifest経由でクライアントに開示し、
 * 章（Chapter）が風化・時刻の共鳴で選べるようにする。
 *
 * 2クエリで取得しアプリ側で束ねる（JOINで行が世代×stemに膨れるのを避け、
 * D1 REST往復も定数に保つ）。
 */
export async function getRecentGenerationsWithStems(
  limit = 8,
): Promise<GenerationStems[]> {
  const generations = await query<DbRow>(
    `SELECT id, created_at FROM music_generation_log
     WHERE status = 'success' ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  if (generations.length === 0) return [];

  // IN句のプレースホルダは匿名?を世代数ぶん並べる
  // （番号付き?Nはbetter-sqlite3が配列バインドで受け付けない：§9.4の教訓）
  const ids = generations.map(function pickId(g) { return g.id as string; });
  const placeholders = ids.map(function toPlaceholder() { return '?'; }).join(', ');
  const stemRows = await query<DbRow>(
    `SELECT * FROM music_stems WHERE generation_id IN (${placeholders})
     ORDER BY CASE stem_role
       WHEN 'rhythm' THEN 0 WHEN 'bass' THEN 1 WHEN 'melody' THEN 2 ELSE 3 END`,
    ids,
  );

  const stemsByGeneration = new Map<string, MusicStem[]>();
  for (const row of stemRows) {
    const stem = rowToStem(row);
    const bucket = stemsByGeneration.get(stem.generationId);
    if (bucket) bucket.push(stem);
    else stemsByGeneration.set(stem.generationId, [stem]);
  }

  return generations.map(function toGeneration(g): GenerationStems {
    return {
      id: g.id as string,
      createdAt: g.created_at as string,
      stems: stemsByGeneration.get(g.id as string) ?? [],
    };
  });
}
