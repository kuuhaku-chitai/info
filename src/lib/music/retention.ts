/**
 * 空白地帯 - 記憶の保持方針（案A：直近30世代）
 *
 * 生成が成功するたびに、保持上限を超えた最も古い世代から順に
 * R2オブジェクト → D1行 の順で消す。
 * ストレージは常に約1.1GB（30世代×37MB）で頭打ちになる。
 *
 * 「記憶は風化し、やがて完全に消える」——地層は無限には堆積しない。
 * これもまた空白地帯の時間の有限性の一部。
 *
 * 安全設計：
 * - 削除は生成成功後にのみ実行（負荷を採取と同じ稀な時間に閉じ込める）
 * - R2削除が失敗した世代はD1行を残す（次回の剪定で再試行される。
 *   逆順だと行だけ消えてR2に孤児オブジェクトが永久に残る）
 * - 1世代の失敗は他の世代の剪定を止めない
 * - 保持件数の勘定は成功世代のみ。現行世代は常に最新＝構造的に消えない
 */

import { deleteObject } from '@/lib/storage';
import { notifyMusicEvent } from '@/lib/discord';
import { getPrunableGenerations, deleteGenerationRows } from './musicDb';

/** 保持する世代数（承認済み・案A） */
export const RETAIN_GENERATIONS = 30;

/** 剪定の結果（ログ・テスト用） */
export interface PruneResult {
  /** 消えた世代数 */
  prunedGenerations: number;
  /** 消えたR2オブジェクト数 */
  prunedObjects: number;
  /** 失敗して次回へ持ち越した世代数 */
  carriedOver: number;
}

/**
 * 保持上限を超えた古い世代を剪定する。
 * 例外はこの関数の外へ投げない（生成の成功を絶対に巻き込まない）。
 */
export async function pruneOldGenerations(
  keep: number = RETAIN_GENERATIONS,
): Promise<PruneResult> {
  const result: PruneResult = {
    prunedGenerations: 0,
    prunedObjects: 0,
    carriedOver: 0,
  };

  try {
    const prunable = await getPrunableGenerations(keep);
    for (const generation of prunable) {
      try {
        // R2が先：ここで失敗したらD1行は残し、次回の剪定で再試行する
        for (const key of generation.r2Keys) {
          await deleteObject(key);
          result.prunedObjects += 1;
        }
        await deleteGenerationRows(generation.id);
        result.prunedGenerations += 1;
      } catch (error) {
        result.carriedOver += 1;
        console.error(`[music] 世代 ${generation.id} の風化に失敗（次回再試行）:`, error);
      }
    }

    if (result.prunedGenerations > 0) {
      // 静かな通知：数字は添えるが、出来事としては小さく
      await notifyMusicEvent(
        '古い記憶が風化した',
        `${result.prunedGenerations}世代が静かに消えた（直近${keep}世代を保持）`,
      );
    }
  } catch (error) {
    console.error('[music] 剪定に失敗:', error);
  }

  return result;
}
