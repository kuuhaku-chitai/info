/**
 * POST /api/auth/login
 *
 * ユーザー名とパスワードを検証し、セッション Cookie を発行する。
 * - ユーザー名: ADMIN_USERNAME 環境変数と比較
 * - パスワード: SHA-256 ハッシュを ADMIN_PASSWORD_HASH と比較（タイミングセーフ）
 * - 成功時: HMAC-SHA256 署名付きセッション Cookie を Set-Cookie ヘッダーで返す
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifyPassword,
  createSessionToken,
  createSessionCookie,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // 環境変数から認証情報を取得
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const sessionSecret = process.env.SESSION_SECRET;

    // 環境変数が未設定の場合は 500（設定ミス）
    if (!adminUsername || !adminPasswordHash || !sessionSecret) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // ユーザー名チェック（タイミングセーフではないが、パスワード検証で補完）
    // パスワード検証は常に実行し、タイミング差を最小化
    const usernameMatch = username === adminUsername;
    const passwordMatch = await verifyPassword(
      password || '',
      adminPasswordHash,
      sessionSecret
    );

    if (!usernameMatch || !passwordMatch) {
      // ユーザー名/パスワードどちらが間違っても同じレスポンス
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // セッショントークン生成
    const token = await createSessionToken(sessionSecret);

    // Cookie 設定（本番は Secure フラグ付き）
    const isSecure = request.nextUrl.protocol === 'https:';
    const cookie = createSessionCookie(token, isSecure);

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
