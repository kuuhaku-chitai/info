/**
 * 空白地帯 - 問い合わせ API
 *
 * POST /api/contact
 * Turnstile検証 → DB保存 → メール送信 → Discord通知
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitContactInquiry } from '@/lib/actions';
import type { InquiryType } from '@/types';

const VALID_INQUIRY_TYPES: InquiryType[] = [
  'general', 'collaboration', 'commission', 'media', 'other',
];

/** Turnstile トークンをサーバーサイドで検証 */
async function verifyTurnstile(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY not set. Skipping verification.');
    return true;
  }

  try {
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
      }
    );

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    console.error('[Turnstile] Verification error:', error);
    return false;
  }
}

/** 簡易メールバリデーション */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, email, phone, organization, inquiryType, message, turnstileToken } = body;

    // バリデーション
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'お名前を入力してください' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !isValidEmail(email)) {
      return NextResponse.json({ error: '有効なメールアドレスを入力してください' }, { status: 400 });
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'お問い合わせ内容を入力してください' }, { status: 400 });
    }
    if (!inquiryType || !VALID_INQUIRY_TYPES.includes(inquiryType)) {
      return NextResponse.json({ error: '問い合わせ種別を選択してください' }, { status: 400 });
    }

    // Turnstile 検証
    if (!turnstileToken) {
      return NextResponse.json({ error: 'bot検証に失敗しました' }, { status: 400 });
    }

    const turnstileValid = await verifyTurnstile(turnstileToken);
    if (!turnstileValid) {
      return NextResponse.json({ error: 'bot検証に失敗しました。再度お試しください' }, { status: 403 });
    }

    // 問い合わせ保存 + メール + Discord（actions内で処理）
    await submitContactInquiry({
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || undefined,
      organization: organization?.trim() || undefined,
      inquiryType,
      message: message.trim(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Contact API] Error:', error);
    return NextResponse.json(
      { error: '送信に失敗しました。しばらく経ってから再度お試しください' },
      { status: 500 }
    );
  }
}
