/**
 * 空白地帯 - アンサンブル再構築 API
 *
 * POST /api/music/rebuild（要認証）
 *
 * 認証は2経路：
 *   1. 管理者セッション（Cookie）→ trigger: 'manual'
 *      管理画面の「Rebuild Ensemble」ボタンが使う。Manualモードでも動作する
 *      （Manualモードが止めるのは自動更新であって、人の意思による再構築ではない）
 *   2. Authorization: Bearer <CRON_SECRET> → trigger: 'auto'
 *      外部スケジューラからのフォールバック経路（Step 8のCron代替）。
 *      CRON_SECRET未設定ならこの経路は完全に閉じる
 *
 * どちらの経路でも生成はrunEnsembleGeneration（唯一の入口）を通り、
 * guard.tsの判定（1日3回・モード・ロック）が必ず適用される。
 * Discord通知（成功・失敗・上限）もgenerate.ts内で行われる。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { runEnsembleGeneration } from '@/lib/music/generate';
import type { MusicTriggerType } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * リクエストの認証とトリガー種別の解決。
 * 認証できなければnull（呼び出し側で401にする）
 */
async function resolveTrigger(request: NextRequest): Promise<MusicTriggerType | null> {
  // 経路1: 管理者セッション（Cookieはroute handlerでも読める）
  const user = await getSession();
  if (user) return 'manual';

  // 経路2: 外部スケジューラ用のBearerトークン
  const cronSecret = await getEnv('CRON_SECRET');
  if (cronSecret) {
    const header = request.headers.get('authorization');
    if (header === `Bearer ${cronSecret}`) return 'auto';
  }

  return null;
}

export async function POST(request: NextRequest) {
  const trigger = await resolveTrigger(request);
  if (!trigger) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 });
  }

  // runEnsembleGenerationは例外を投げない設計（失敗もresult値で返る）だが、
  // 万一の想定外（DB接続不能など）に備えて外側でも受け止める
  try {
    const result = await runEnsembleGeneration(trigger);

    // skippedは「正しくガードが働いた」結果なので200で理由を返す。
    // 呼び出し側（管理画面・スケジューラ）はreasonを表示・記録すればよい
    const httpStatus = result.status === 'failed' ? 500 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    console.error('[music/rebuild] 想定外のエラー:', error);
    return NextResponse.json(
      { status: 'failed', reason: '想定外のエラーが発生しました' },
      { status: 500 },
    );
  }
}
