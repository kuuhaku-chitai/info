/**
 * 空白地帯 - カスタムWorkerエントリ
 *
 * OpenNextのビルド出力（.open-next/worker.js）をそのまま包み、
 * `scheduled`ハンドラ（Cron Trigger）だけを付け足す。
 * HTTPの挙動は一切変えない——fetchはOpenNextへ素通しする。
 *
 * Cron → 音楽の自動採取の経路：
 *   毎時0分にCronが目を覚ます
 *   → 自分自身のfetchハンドラを「in-process」で呼ぶ
 *     （POST /api/music/rebuild + Bearer CRON_SECRET）
 *   → ルートがtrigger: 'auto'として runEnsembleGeneration へ
 *   → guard.tsが判定：予定時刻の「時」か／Autoモードか／1日3回以内か／ロック
 *
 * なぜ self-fetch 方式か：
 * - schedule時刻・モードはD1にあり、アプリのコード（OpenNextの環境初期化）を
 *   通らないと安全に読めない。in-processのfetchなら通常リクエストと
 *   完全に同じコードパス・同じガードを通る＝経路による抜け穴が生まれない。
 * - CRON_SECRET未設定ならこの経路は静かに閉じたまま（手動運用に影響なし）。
 */

import openNextHandler from '../.open-next/worker.js';

// OpenNextが必要とするDurable Objectクラスを忘れずに再輸出する
// （これが欠けるとデプロイ時にDOの解決に失敗する）
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from '../.open-next/worker.js';

/** scheduledが参照する環境変数（他はOpenNextがenvごと受け取る） */
interface CronEnv {
  CRON_SECRET?: string;
  NEXT_PUBLIC_BASE_URL?: string;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
}

/** Cron発火時の処理本体（名前付き関数：ハンドラから分離） */
async function runScheduledRebuild(
  env: CronEnv,
  ctx: ExecutionContextLike,
): Promise<void> {
  if (!env.CRON_SECRET) {
    // 秘密が無ければ自動採取の扉は閉じたまま。エラーにはしない（手動運用は正当な状態）
    console.warn('[cron] CRON_SECRET未設定のため音楽の自動採取は休止中');
    return;
  }

  const base = env.NEXT_PUBLIC_BASE_URL || 'https://kuuhaku-chitai.net';
  const request = new Request(`${base}/api/music/rebuild`, {
    method: 'POST',
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });

  try {
    // in-processで自分のfetchを呼ぶ：ネットワークに出ないため
    // 「Workerが自分自身を呼べない」制限（エラー1042）を踏まない
    const response = await openNextHandler.fetch(request, env, ctx);
    const body = await response.text();
    console.log(`[cron] music rebuild: HTTP ${response.status} ${body}`);
  } catch (error) {
    console.error('[cron] music rebuild 失敗:', error);
  }
}

const worker = {
  /** HTTPはOpenNextへ素通し */
  fetch: openNextHandler.fetch,

  /** Cron Trigger（wrangler.tomlの[triggers]crons） */
  async scheduled(
    _controller: unknown,
    env: CronEnv,
    ctx: ExecutionContextLike,
  ): Promise<void> {
    ctx.waitUntil(runScheduledRebuild(env, ctx));
  },
};

export default worker;
