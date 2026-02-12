/**
 * 空白地帯 - サブドメインルーティング + 認証ガード
 *
 * admin.localhost (開発) / admin.{domain} (本番) でアクセスされた場合、
 * 内部的に /admin/* パスに rewrite して管理画面を表示する。
 * メインドメインの /admin/* はサブドメインにリダイレクトする。
 *
 * admin サブドメインでは Cookie ベースの認証を要求。
 * 未認証の場合は /login にリダイレクト。
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionCookieValue,
  verifySessionToken,
} from '@/lib/auth';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // GLB ファイル: Workers アセット上限(25MB)を超えるため R2 から配信
  // 本番では R2_PUBLIC_URL にリダイレクト、開発環境では public/ から直接配信
  if (pathname.startsWith('/assets/glb/')) {
    const r2PublicUrl = process.env.R2_PUBLIC_URL;
    if (r2PublicUrl) {
      return NextResponse.redirect(`${r2PublicUrl}${pathname}`, 308);
    }
    return NextResponse.next();
  }

  // admin サブドメインからのリクエスト
  if (hostname.startsWith('admin.')) {
    // /login パスは認証不要で通過
    if (pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin/login';
      return NextResponse.rewrite(url);
    }

    // 認証チェック
    const sessionSecret = process.env.SESSION_SECRET;
    if (sessionSecret) {
      const cookieHeader = request.headers.get('cookie');
      const token = getSessionCookieValue(cookieHeader);

      const isValid = token
        ? await verifySessionToken(token, sessionSecret)
        : false;

      if (!isValid) {
        // 未認証: ログインページにリダイレクト
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = '/login';
        return NextResponse.redirect(loginUrl);
      }
    }

    // 認証済み: /admin パスに rewrite
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // メインドメインの /admin/* へのアクセス: admin サブドメインにリダイレクト
  if (pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    // ホスト名に admin. プレフィックスを付与
    const [host, port] = hostname.split(':');
    const adminHost = `admin.${host}${port ? `:${port}` : ''}`;
    url.host = adminHost;
    // /admin プレフィックスを除去（/admin → /, /admin/posts → /posts）
    url.pathname = pathname.replace(/^\/admin/, '') || '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|images|favicon\\.ico).*)'],
};
