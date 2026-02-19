'use server';

/**
 * 空白地帯 - Discord通知ユーティリティ
 *
 * このモジュールはコミュニティへの「信号送信」を担当する。
 * サイトの状態変化（延命、新規イベント、危機）を
 * Discordに伝播させることで、プロジェクトを「生きた」ものにする。
 *
 * Server Actionとして実装されているため、
 * クライアントから直接呼び出すことができる。
 */

import { type NotificationType, type DiscordNotificationPayload } from '@/types';
import { DISCORD_COLORS } from './constants';
import { getEnv } from './env';

/**
 * Discord Webhook URLを取得
 * 環境変数から取得し、未設定の場合はエラーをログ出力して処理を続行
 */
async function getWebhookUrl(): Promise<string | null> {
  const url = await getEnv('DISCORD_WEBHOOK_URL');
  if (!url) {
    console.warn('[Discord] DISCORD_WEBHOOK_URL is not set. Notification skipped.');
    return null;
  }
  return url;
}

/**
 * Discord通知を送信する
 *
 * @param payload 通知内容
 * @returns 成功時はtrue、失敗時はfalse
 *
 * @example
 * // 延命通知
 * await sendDiscordNotification({
 *   type: 'lifespan',
 *   message: '新たな延命が行われました',
 *   embed: {
 *     title: '+30日の命',
 *     description: '誰かが80,000円を注ぎ込んだ。',
 *   }
 * });
 */
export async function sendDiscordNotification(
  payload: DiscordNotificationPayload
): Promise<boolean> {
  const webhookUrl = await getWebhookUrl();
  if (!webhookUrl) {
    return false;
  }

  const { type, message, embed } = payload;

  // Discord Webhook用のペイロードを構築
  // 「空白」のコンセプトを反映し、装飾を最小限に
  const discordPayload = {
    content: message,
    embeds: embed
      ? [
        {
          title: embed.title,
          description: embed.description,
          color: embed.color ?? DISCORD_COLORS[type],
          timestamp: embed.timestamp ?? new Date().toISOString(),
          footer: {
            text: '空白地帯',
          },
        },
      ]
      : undefined,
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      console.error(`[Discord] Failed to send notification: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Discord] Error sending notification:', error);
    return false;
  }
}

/**
 * 延命通知を送信する
 * 入金があった際に呼び出される専用関数
 *
 * @param addedDays 追加された日数
 * @param totalRemainingDays 残り総日数
 */
export async function notifyLifespanExtension(
  addedDays: number,
  totalRemainingDays: number
): Promise<boolean> {
  return sendDiscordNotification({
    type: 'lifespan',
    message: '⟡ 延命',
    embed: {
      title: `+${addedDays}日`,
      description: `残り ${totalRemainingDays.toLocaleString()} 日`,
      color: DISCORD_COLORS.lifespan,
    },
  });
}

/**
 * 新規イベント通知を送信する
 *
 * @param eventTitle イベントタイトル
 * @param eventDate イベント日時
 */
export async function notifyNewEvent(
  eventTitle: string,
  eventDate: string
): Promise<boolean> {
  return sendDiscordNotification({
    type: 'event',
    message: '⟡ 新規イベント',
    embed: {
      title: eventTitle,
      description: eventDate,
      color: DISCORD_COLORS.event,
    },
  });
}

/**
 * マイルストーン通知を送信する
 * 残り100日、50日、30日などの節目で呼び出す
 *
 * @param remainingDays 残り日数
 */
export async function notifyMilestone(remainingDays: number): Promise<boolean> {
  return sendDiscordNotification({
    type: 'milestone',
    message: `⟡ 残り ${remainingDays} 日`,
    embed: {
      title: `残り ${remainingDays} 日`,
      description: '時間は流れ続けている。',
      color: DISCORD_COLORS.milestone,
    },
  });
}

/**
 * 危機通知を送信する
 * 残り30日以下になった際に呼び出す
 *
 * @param remainingDays 残り日数
 */
export async function notifyCritical(remainingDays: number): Promise<boolean> {
  return sendDiscordNotification({
    type: 'critical',
    message: `⟡ 残り ${remainingDays} 日 - 終焉が近い`,
    embed: {
      title: `残り ${remainingDays} 日`,
      description: 'この空白は、まもなく消える。',
      color: DISCORD_COLORS.critical,
    },
  });
}

/**
 * 問い合わせ種別の日本語ラベル
 */
const INQUIRY_TYPE_LABELS: Record<string, string> = {
  general: '一般',
  collaboration: 'コラボ',
  commission: '依頼',
  media: '取材',
  other: 'その他',
};

/**
 * 新規問い合わせ通知を送信する
 *
 * @param name 問い合わせ者の名前
 * @param inquiryType 問い合わせ種別
 */
export async function notifyNewInquiry(
  name: string,
  inquiryType: string
): Promise<boolean> {
  const typeLabel = INQUIRY_TYPE_LABELS[inquiryType] || inquiryType;
  return sendDiscordNotification({
    type: 'inquiry',
    message: '⟡ 新規問い合わせ',
    embed: {
      title: `${name} - ${typeLabel}`,
      description: '問い合わせが届いた。',
      color: DISCORD_COLORS.inquiry,
    },
  });
}
