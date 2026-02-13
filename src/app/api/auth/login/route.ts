/**
 * POST /api/auth/login
 *
 * D1 の admin_users テーブルからユーザーを検索し、
 * PBKDF2 でパスワードを検証。成功時は D1 にセッションを作成し Cookie を発行。
 */

import { NextRequest, NextResponse } from 'next/server';
import { getUserByUsername } from '@/lib/db';
import {
  verifyPassword,
  createSession,
  createSessionCookie,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }

    // D1 からユーザー検索
    const user = await getUserByUsername(username);

    // ユーザーが存在しなくても verifyPassword を実行し、タイミング差を最小化
    const passwordMatch = user
      ? await verifyPassword(password, user.passwordHash)
      : await verifyPassword(password, 'pbkdf2:100000:00:00'); // ダミー検証

    if (!user || !passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // D1 にセッション作成
    const sessionId = await createSession(user.id);

    // Cookie 設定
    const isSecure = request.nextUrl.protocol === 'https:';
    const cookie = createSessionCookie(sessionId, isSecure);

    const response = NextResponse.json({ success: true });
    response.headers.set('Set-Cookie', cookie);

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
