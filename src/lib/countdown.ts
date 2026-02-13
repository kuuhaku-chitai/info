/**
 * 空白地帯 - カウントダウン計算ユーティリティ
 *
 * このモジュールは「寿命」の計算を担当する。
 * 時間の経過は不可逆であり、延命のみが可能。
 * これは人生のメタファーでもある。
 */

import { type CountdownState } from '@/types';
import { INITIAL_TOTAL_SECONDS, MONTHLY_COST, INITIAL_FUND, amountToSeconds } from './constants';

/**
 * デフォルトのカウントダウン状態を生成
 * プロジェクト開始時に一度だけ呼び出される
 *
 * @param startDate プロジェクト開始日時（省略時は現在時刻）
 */
export function createInitialCountdownState(
  startDate: string = new Date().toISOString()
): CountdownState {
  return {
    startDate,
    initialTotalSeconds: INITIAL_TOTAL_SECONDS,
    addedSeconds: 0,
    monthlyCost: MONTHLY_COST,
    initialFund: INITIAL_FUND,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 現在の残り秒数を計算する
 *
 * @param state カウントダウン状態
 * @returns 残り秒数（負の値になることもある = 「死後」の状態）
 */
export function calculateRemainingSeconds(state: CountdownState): number {
  const startTime = new Date(state.startDate).getTime();
  const currentTime = Date.now();

  // 経過秒数
  const elapsedSeconds = Math.floor((currentTime - startTime) / 1000);

  // 総寿命（初期 + 延命）
  const totalLifespan = state.initialTotalSeconds + state.addedSeconds;

  // 残り秒数
  return totalLifespan - elapsedSeconds;
}

/**
 * 残り秒数を時間単位に分解する
 *
 * @param totalSeconds 残り総秒数
 * @returns 日、時、分、秒に分解されたオブジェクト
 */
export function formatRemainingTime(totalSeconds: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
} {
  const isExpired = totalSeconds <= 0;
  const absSeconds = Math.abs(totalSeconds);

  const days = Math.floor(absSeconds / (24 * 60 * 60));
  const hours = Math.floor((absSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((absSeconds % (60 * 60)) / 60);
  const seconds = absSeconds % 60;

  return { days, hours, minutes, seconds, isExpired };
}

/**
 * 残り秒数を人間が読める形式に変換
 * 表示は控えめに、数字を大きくしない
 *
 * @param totalSeconds 残り総秒数
 * @returns フォーマットされた文字列
 */
export function formatRemainingTimeString(totalSeconds: number): string {
  const { days, hours, minutes, seconds, isExpired } =
    formatRemainingTime(totalSeconds);

  if (isExpired) {
    return '終了';
  }

  // 日数のみ表示（細かい時間は省略して「曖昧さ」を演出）
  if (days > 0) {
    return `${days}日`;
  }

  // 残り1日未満の場合のみ詳細表示
  if (hours > 0) {
    return `${hours}時間`;
  }

  if (minutes > 0) {
    return `${minutes}分`;
  }

  return `${seconds}秒`;
}

/**
 * 延命処理を適用し、新しい状態を返す
 *
 * @param state 現在のカウントダウン状態
 * @param amount 入金額（円）
 * @returns 更新されたカウントダウン状態
 */
export function applyLifespanExtension(
  state: CountdownState,
  amount: number
): CountdownState {
  const additionalSeconds = amountToSeconds(amount);

  return {
    ...state,
    addedSeconds: state.addedSeconds + additionalSeconds,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * マイルストーンをチェックする
 * 通知すべきマイルストーンがあればその値を返す
 *
 * @param previousSeconds 前回の残り秒数
 * @param currentSeconds 現在の残り秒数
 * @returns マイルストーン日数（該当なしの場合はnull）
 */
export function checkMilestone(
  previousSeconds: number,
  currentSeconds: number
): number | null {
  const milestones = [365, 180, 100, 60, 30, 14, 7, 3, 1]; // 日数

  const previousDays = Math.floor(previousSeconds / (24 * 60 * 60));
  const currentDays = Math.floor(currentSeconds / (24 * 60 * 60));

  for (const milestone of milestones) {
    // マイルストーンを跨いだかチェック
    if (previousDays > milestone && currentDays <= milestone) {
      return milestone;
    }
  }

  return null;
}

/**
 * 危機状態かどうかをチェック
 * 残り30日以下で危機状態とみなす
 *
 * @param remainingSeconds 残り秒数
 * @returns 危機状態の場合true
 */
export function isCritical(remainingSeconds: number): boolean {
  const remainingDays = remainingSeconds / (24 * 60 * 60);
  return remainingDays <= 30 && remainingDays > 0;
}

/**
 * 終了状態かどうかをチェック
 *
 * @param remainingSeconds 残り秒数
 * @returns 終了している場合true
 */
export function isExpired(remainingSeconds: number): boolean {
  return remainingSeconds <= 0;
}
