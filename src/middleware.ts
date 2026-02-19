/**
 * 空白地帯 - サブドメインルーティング + 認証ガード
 *
 * admin サブドメインでは Cookie の存在をチェック（ルーティングガード）。
 * 実際のセッション検証は (dashboard)/layout.tsx で行う。
 *
 * ミドルウェアで D1 を叩かない理由:
 * db.ts は better-sqlite3 を動的 import するため Edge Runtime で使用不可。
 * Cookie 存在チェックだけで未認証ユーザーを弾き、
 * セッション失効は layout の getSession() で捕捉する。
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // GLB ファイル: Workers アセット上限(25MB)を超えるため R2 から配信
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

    // Cookie 存在チェック（DB 検証は layout で行う）
    const sessionCookie = request.cookies.get('admin_session');
    if (!sessionCookie?.value) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = '/login';
      return NextResponse.redirect(loginUrl);
    }

    // Cookie あり: /admin パスに rewrite
    const url = request.nextUrl.clone();
    url.pathname = `/admin${pathname}`;
    return NextResponse.rewrite(url);
  }

  // メインドメインの /admin/* へのアクセス: admin サブドメインにリダイレクト
  if (pathname.startsWith('/admin')) {
    const url = request.nextUrl.clone();
    const [host, port] = hostname.split(':');
    const adminHost = `admin.${host}${port ? `:${port}` : ''}`;
    url.host = adminHost;
    url.pathname = pathname.replace(/^\/admin/, '') || '/';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|api|images|favicon\\.ico).*)'],
};
