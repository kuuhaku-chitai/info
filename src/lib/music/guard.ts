/**
 * 空白地帯 - Lyria使用ガード（純粋関数）
 *
 * 「1日最大3回」のコストポリシーと更新モード（Auto/Manual）の判定を、
 * DBにもHTTPにも触れない純粋関数として実装する。
 *
 * なぜ純粋か：
 * - UIのボタン無効化・Cronの条件分岐・APIの入口——どの経路から来ても
 *   同じ判定関数を通ることで、コスト上限が「一箇所で」強制される。
 * - 入力（現在の設定・当日の成功回数・トリガー種別）をすべて引数で受けるため、
 *   全パターンをテストで検証できる。
 */

import type { MusicTriggerType, MusicUpdateMode } from '@/types';

/** Lyria呼び出しの1日あたり上限（CLAUDE.md「Cost + Continuity Strategy」） */
export const DAILY_GENERATION_LIMIT = 3;

/**
 * 生成ロックを「孤児（stale）」とみなすまでの時間（ミリ秒）。
 *
 * なぜ必要か：生成は必ずfinallyでロックを解放するが、Workerが採取の途中で
 * 落ちる（Lyriaタイムアウト・デプロイ・クラッシュ）とfinallyが走らず、
 * is_generating=1が永久に張り付いてしまう——実際、管理画面が「別の採取が進行中」で
 * 詰まる原因はこれ。1回の採取は数分で終わり、Worker自体の実行時間上限も
 * それより短いため、この時間を過ぎてなお立っているロックは「死んだWorkerのCompute置き土産」。
 * その古いロックは無視して奪い取る（自己修復）。
 */
export const STALE_LOCK_MS = 5 * 60 * 1000;

/** ガード判定への入力。呼び出し側がDBから読んで渡す */
export interface GuardInput {
  /** 現在の更新モード */
  mode: MusicUpdateMode;
  /** 生成中ロックが立っているか */
  isGenerating: boolean;
  /** 当日（JST基準）の成功済み生成回数 */
  todaySuccessCount: number;
  /** 今回のトリガー種別 */
  trigger: MusicTriggerType;
}

/** ガード判定の結果。拒否時は理由を必ず添える（ログ・Discord通知の材料） */
export type GuardDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * 生成リクエストを許可するか判定する。
 *
 * 判定順序に意味がある：
 * 1. Manual時のautoトリガーは「モードの意思」による拒否（最優先。
 *    Manualは自動更新の完全停止を約束している）
 * 2. ロック中は二重生成の拒否
 * 3. 上限到達はコストの拒否
 * 手動トリガー（Rebuildボタン）はどちらのモードでも通す——
 * ただし上限3回はトリガー種別に関係なく適用される。
 */
export function evaluateGenerationRequest(input: GuardInput): GuardDecision {
  if (input.trigger === 'auto' && input.mode === 'manual') {
    return { allowed: false, reason: 'Manualモードのため自動更新は停止中' };
  }
  if (input.isGenerating) {
    return { allowed: false, reason: '別の生成が進行中（二重生成ロック）' };
  }
  if (input.todaySuccessCount >= DAILY_GENERATION_LIMIT) {
    return {
      allowed: false,
      reason: `本日の生成上限（${DAILY_GENERATION_LIMIT}回）に到達済み`,
    };
  }
  return { allowed: true };
}

/**
 * ロックが孤児化（stale）しているかを判定する純粋関数。
 *
 * lockUpdatedAt はロック取得時に刻まれた music_settings.updated_at。
 * これが STALE_LOCK_MS より前なら、そのロックは生きたWorkerではなく
 * 途中で落ちたWorkerの置き土産——奪い取ってよい。
 * 時刻が読めない（壊れた記録）場合も「古い」とみなし、復旧を優先する。
 */
export function isGenerationLockStale(lockUpdatedAt: string, now: Date): boolean {
  const lockedMs = Date.parse(lockUpdatedAt);
  if (Number.isNaN(lockedMs)) return true;
  return now.getTime() - lockedMs >= STALE_LOCK_MS;
}

/**
 * 「今日」の始まり（JST 00:00）をUTCのISO文字列で返す。
 * 上限カウントの基準日はサーバのタイムゾーンではなくJSTに固定する
 * ——朝・昼・晩のスケジュールも空間（東京のアトリエ）の一日に属するため。
 */
export function jstDayStartUtcIso(now: Date): string {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstMs = now.getTime() + JST_OFFSET_MS;
  const jstDayStartMs = Math.floor(jstMs / 86400000) * 86400000;
  return new Date(jstDayStartMs - JST_OFFSET_MS).toISOString();
}

/** 管理画面で設定される朝・昼・晩の時刻（JST "HH:MM"） */
export interface ScheduleSlots {
  scheduleMorning: string;
  scheduleNoon: string;
  scheduleEvening: string;
}

/**
 * 現在（JST）が自動採取の予定時刻の「時」に当たるかを判定する。
 *
 * Cronは毎時0分に淡々と目を覚まし、この関数がYesと言った時だけ採取へ進む
 * ——固定Cronのままで、管理画面のスケジュール変更が反映される仕組み。
 * 粒度は時間単位（分は無視される）。空白地帯の音に分刻みの正確さは要らない。
 */
export function matchesScheduleHour(slots: ScheduleSlots, now: Date): boolean {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const jstHour = Math.floor(
    ((now.getTime() + JST_OFFSET_MS) % 86400000) / 3600000,
  );
  const slotHours = [slots.scheduleMorning, slots.scheduleNoon, slots.scheduleEvening]
    .map(parseHour)
    .filter(isValidHour);
  return slotHours.includes(jstHour);
}

/** "HH:MM" → 時（数値）。名前付き変換関数 */
function parseHour(time: string): number {
  return Number.parseInt(time.slice(0, 2), 10);
}

/** 0-23の妥当な時か */
function isValidHour(hour: number): boolean {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}
