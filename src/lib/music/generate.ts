/**
 * 空白地帯 - アンサンブル生成オーケストレーター
 *
 * 「History取得 → Memory Engine → Lyria採取 → R2保存 → manifest更新」の
 * 一連の流れを束ねる唯一の入口。Cron（Auto）も管理画面のRebuildボタン（Manual）も
 * 必ずこの関数を通る——ガード（1日3回・モード・ロック）が経路によらず効くように。
 *
 * 役割分担：
 *   guard.ts        … 判定（純粋）
 *   memoryEngine.ts … 翻訳（純粋）
 *   lyria.ts        … 採取（ネットワーク副作用のみ）
 *   musicDb.ts      … 永続化（DB副作用のみ）
 *   このファイル     … 上記の配線と、失敗時も必ずロックを解放する責務
 */

import { getAllBranches, getAllVersions, getAllRelations } from '@/lib/db';
import { getEnv } from '@/lib/env';
import { uploadObject } from '@/lib/storage';
import { notifyMusicEvent } from '@/lib/discord';
import { computeMusicState, buildStemPromptPlans } from './memoryEngine';
import {
  evaluateGenerationRequest,
  jstDayStartUtcIso,
  matchesScheduleHour,
} from './guard';
import { buildStemPassPlan, captureStems } from './lyria';
import {
  getMusicSettings,
  acquireGenerationLock,
  releaseGenerationLock,
  countTodaySuccess,
  insertGenerationLog,
  finishGenerationLog,
  getLatestMusicState,
  getActiveTemplates,
  replaceCurrentStems,
} from './musicDb';
import { pruneOldGenerations } from './retention';
import type { MusicTriggerType, VersionGraphData } from '@/types';

/** 生成結果。呼び出し側（API route / Cron）がHTTPステータスやログに変換する */
export interface EnsembleGenerationResult {
  status: 'success' | 'skipped' | 'failed';
  /** skipped / failed の理由（ユーザー・ログ向け） */
  reason?: string;
  /** 成功時の生成ID（= music_generation_log.id / R2キーのプレフィックス） */
  generationId?: string;
}

/**
 * アンサンブルを再構築する（唯一の生成入口）。
 *
 * 例外はこの関数の外へ投げない：どんな失敗も 'failed' の結果値と
 * ログ・Discord通知に変換する。Cronから呼ばれたとき、例外が
 * Worker全体を巻き込まないようにするため。
 */
export async function runEnsembleGeneration(
  trigger: MusicTriggerType,
): Promise<EnsembleGenerationResult> {
  const startedAt = Date.now();

  // --- ガード（純粋関数に入力を渡すだけ。判定ロジックはここに書かない） ---
  const settings = await getMusicSettings();

  // 自動トリガーは予定時刻（朝・昼・晩の「時」）だけを通す。
  // Cronは毎時目を覚ますため、時刻外の見送りはログに残さない
  // ——21回/日の「何もしなかった記録」で採取の記録を埋めないため
  if (trigger === 'auto' && !matchesScheduleHour(settings, new Date())) {
    return { status: 'skipped', reason: '予定時刻（朝・昼・晩）ではない' };
  }

  const todaySuccessCount = await countTodaySuccess(jstDayStartUtcIso(new Date()));
  const decision = evaluateGenerationRequest({
    mode: settings.mode,
    isGenerating: settings.isGenerating,
    todaySuccessCount,
    trigger,
  });
  if (!decision.allowed) {
    await insertGenerationLog({
      id: crypto.randomUUID(),
      triggerType: trigger,
      status: 'skipped',
      error: decision.reason,
    });
    return { status: 'skipped', reason: decision.reason };
  }

  // --- ロック取得（楽観ロック。負けたら静かに退く） ---
  const lockStamp = new Date().toISOString();
  const locked = await acquireGenerationLock(lockStamp);
  if (!locked) {
    const reason = '別の生成が進行中（ロック競合）';
    await insertGenerationLog({
      id: crypto.randomUUID(),
      triggerType: trigger,
      status: 'skipped',
      error: reason,
    });
    return { status: 'skipped', reason };
  }

  const generationId = crypto.randomUUID();
  try {
    // --- History → Memory Engine（空間の記憶を音の状態へ） ---
    const graph = await fetchGraphForMusic();
    const previousState = await getLatestMusicState();
    const state = computeMusicState(graph, previousState, new Date());
    const templates = await getActiveTemplates();
    const plans = buildStemPromptPlans(state, templates);
    if (plans.length === 0) {
      const reason = '有効なプロンプトテンプレートがありません';
      await insertGenerationLog({
        id: generationId,
        triggerType: trigger,
        status: 'skipped',
        musicState: state,
        error: reason,
      });
      return { status: 'skipped', reason };
    }

    // 採取開始を先に記録する：途中でWorkerごと落ちても「startedのまま」の
    // ログが残り、管理画面から異常を検知できる
    await insertGenerationLog({
      id: generationId,
      triggerType: trigger,
      status: 'started',
      musicState: state,
      prompts: plans,
    });

    // --- APIキー（サーバのみ。クライアントへは一切渡らない） ---
    const apiKey = await getEnv('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY が設定されていません');
    }

    // --- Lyria採取（1セッション・steer連続・上限固定） ---
    const passes = buildStemPassPlan(plans, state);
    const { stems, filteredPrompts } = await captureStems({ apiKey, passes });

    // --- R2保存 → manifest差し替え（挿入が先。現行が空になる瞬間を作らない） ---
    const stemRows = [];
    for (const stem of stems) {
      const key = `music/stems/${generationId}/${stem.role}.wav`;
      const { url } = await uploadObject(key, stem.wav, 'audio/wav');
      stemRows.push({
        id: crypto.randomUUID(),
        stemRole: stem.role,
        r2Key: key,
        url,
        durationSec: stem.durationSec,
      });
    }
    await replaceCurrentStems(generationId, stemRows);

    const durationMs = Date.now() - startedAt;
    const filteredNote =
      filteredPrompts.length > 0 ? ` / フィルタされたprompt: ${filteredPrompts.join('; ')}` : '';
    await finishGenerationLog(generationId, 'success', { durationMs });
    await notifyMusicEvent(
      'アンサンブル再構築',
      `${trigger === 'auto' ? '自動' : '手動'} / ${stems.length} stems / ${Math.round(durationMs / 1000)}秒 / 本日${todaySuccessCount + 1}回目${filteredNote}`,
    );

    // 保持方針（案A）：成功時にだけ、上限を超えた古い世代を風化させる。
    // pruneOldGenerationsは例外を外へ投げない設計だが、
    // 万一にも成功した生成を巻き込まないよう二重に守る
    try {
      await pruneOldGenerations();
    } catch (error) {
      console.error('[music] 剪定の想定外エラー:', error);
    }

    return { status: 'success', generationId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // startedログが無いまま失敗した可能性もあるため、更新失敗は握りつぶさず追記で残す
    try {
      await finishGenerationLog(generationId, 'failed', {
        error: message,
        durationMs: Date.now() - startedAt,
      });
    } catch {
      console.error('[music] 失敗ログの更新に失敗:', message);
    }
    await notifyMusicEvent('生成失敗', `${trigger === 'auto' ? '自動' : '手動'} / ${message}`);
    return { status: 'failed', reason: message };
  } finally {
    // どの経路でも必ずロックを解放する（次の朝・昼・晩を止めない）
    await releaseGenerationLock();
  }
}

/**
 * 音楽生成用のHistoryグラフ取得。
 * actions.ts（'use server'）を経由せずdb層を直接呼ぶ：
 * Cron（リクエストコンテキスト外）からも同じコードパスで動かすため。
 */
async function fetchGraphForMusic(): Promise<VersionGraphData> {
  const [branches, versions, relations] = await Promise.all([
    getAllBranches(),
    getAllVersions(),
    getAllRelations(),
  ]);
  return { branches, versions, relations };
}
