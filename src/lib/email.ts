/**
 * 空白地帯 - メール送信ユーティリティ
 *
 * Resend REST API を直接 fetch で呼び出す。
 * SDK を使わず軽量に保つ（Cloudflare Workers 互換）。
 *
 * 送信元: info@kuuhaku-chitai.net（Resend ドメイン認証済み）
 */

import { type ContactInquiry } from '@/types';

const FROM_EMAIL = 'info@kuuhaku-chitai.net';
const FROM_NAME = '空白地帯';
const RESEND_API_URL = 'https://api.resend.com/emails';

/** 問い合わせ種別の日本語ラベル */
const INQUIRY_TYPE_LABELS: Record<string, string> = {
  general: '一般的なお問い合わせ',
  collaboration: 'コラボレーション・協業',
  commission: '制作依頼',
  media: '取材・メディア関連',
  other: 'その他',
};

/**
 * Resend API でメールを送信する
 */
async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY is not set. Email skipped.');
    return false;
  }

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[Email] Failed to send: ${response.status} ${error}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Email] Error sending email:', error);
    return false;
  }
}

/**
 * 問い合わせ送信者への自動返信メール
 *
 * 受け取った問い合わせ内容の控えを含む。
 * 「空白」のコンセプトを反映し、装飾を最小限に。
 */
export async function sendAutoReply(
  to: string,
  name: string,
  inquiryType: string,
  message: string
): Promise<boolean> {
  const typeLabel = INQUIRY_TYPE_LABELS[inquiryType] || inquiryType;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
  <p style="font-size: 14px; line-height: 1.8;">${name} 様</p>
  <p style="font-size: 14px; line-height: 1.8;">
    お問い合わせいただきありがとうございます。<br>
    以下の内容で受け付けました。
  </p>
  <div style="margin: 24px 0; padding: 16px; border-left: 2px solid #E8E8E8; color: #666;">
    <p style="font-size: 12px; margin: 0 0 8px;"><strong>種別:</strong> ${typeLabel}</p>
    <p style="font-size: 12px; margin: 0; white-space: pre-wrap;"><strong>内容:</strong><br>${escapeHtml(message)}</p>
  </div>
  <p style="font-size: 14px; line-height: 1.8;">
    内容を確認のうえ、改めてご連絡いたします。<br>
    通常、2〜3営業日以内に返信いたします。
  </p>
  <hr style="border: none; border-top: 1px solid #E8E8E8; margin: 32px 0;">
  <p style="font-size: 11px; color: #BFBFBF;">
    空白地帯<br>
    https://kuuhaku-chitai.net
  </p>
</div>`.trim();

  return sendEmail({
    to,
    subject: '【空白地帯】お問い合わせを受け付けました',
    html,
  });
}

/**
 * 管理者への通知メール
 *
 * 問い合わせ内容の全文を含む。
 */
export async function sendAdminNotification(
  inquiry: ContactInquiry
): Promise<boolean> {
  const typeLabel = INQUIRY_TYPE_LABELS[inquiry.inquiryType] || inquiry.inquiryType;

  const html = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1A1A1A;">
  <h2 style="font-size: 16px; font-weight: normal;">新しい問い合わせ</h2>
  <table style="font-size: 13px; line-height: 1.6; border-collapse: collapse; width: 100%;">
    <tr>
      <td style="padding: 4px 12px 4px 0; color: #999; vertical-align: top;">名前</td>
      <td style="padding: 4px 0;">${escapeHtml(inquiry.name)}</td>
    </tr>
    <tr>
      <td style="padding: 4px 12px 4px 0; color: #999; vertical-align: top;">メール</td>
      <td style="padding: 4px 0;"><a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a></td>
    </tr>
    ${inquiry.phone ? `<tr><td style="padding: 4px 12px 4px 0; color: #999; vertical-align: top;">電話</td><td style="padding: 4px 0;">${escapeHtml(inquiry.phone)}</td></tr>` : ''}
    ${inquiry.organization ? `<tr><td style="padding: 4px 12px 4px 0; color: #999; vertical-align: top;">団体名</td><td style="padding: 4px 0;">${escapeHtml(inquiry.organization)}</td></tr>` : ''}
    <tr>
      <td style="padding: 4px 12px 4px 0; color: #999; vertical-align: top;">種別</td>
      <td style="padding: 4px 0;">${typeLabel}</td>
    </tr>
  </table>
  <div style="margin: 16px 0; padding: 16px; background: #FAFAFA; border: 1px solid #E8E8E8; border-radius: 4px;">
    <p style="font-size: 13px; line-height: 1.8; margin: 0; white-space: pre-wrap;">${escapeHtml(inquiry.message)}</p>
  </div>
  <p style="font-size: 12px; color: #999;">
    ${inquiry.createdAt}
  </p>
</div>`.trim();

  return sendEmail({
    to: FROM_EMAIL,
    subject: `【問い合わせ】${inquiry.name} - ${typeLabel}`,
    html,
  });
}

/** HTMLエスケープ */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
