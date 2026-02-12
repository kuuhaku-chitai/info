/**
 * POST /api/auth/logout
 *
 * セッション Cookie を削除してログアウトする。
 */

import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const isSecure = request.nextUrl.protocol === 'https:';
  const cookie = clearSessionCookie(isSecure);

  const response = NextResponse.json({ success: true });
  response.headers.set('Set-Cookie', cookie);

  return response;
}
