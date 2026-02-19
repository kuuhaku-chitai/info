/**
 * POST /api/auth/logout
 *
 * D1 からセッションを削除し、Cookie をクリアしてログアウトする。
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionCookieValue,
  deleteSession,
  clearSessionCookie,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  // Cookie からセッション ID を取得して D1 から削除
  const cookieHeader = request.headers.get('cookie');
  const sessionId = getSessionCookieValue(cookieHeader);
  if (sessionId) {
    await deleteSession(sessionId);
  }

  // Cookie クリア
  const isSecure = request.nextUrl.protocol === 'https:';
  const cookie = clearSessionCookie(isSecure);

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', cookie);

  return response;
}
