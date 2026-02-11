/**
 * 空白地帯 - サブドメインルーティング
 *
 * admin.localhost (開発) / admin.{domain} (本番) でアクセスされた場合、
 * 内部的に /admin/* パスに rewrite して管理画面を表示する。
 * メインドメインの /admin/* はサブドメインにリダイレクトする。
 */

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // admin サブドメインからのリクエスト: /admin パスに rewrite
  if (hostname.startsWith('admin.')) {
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
