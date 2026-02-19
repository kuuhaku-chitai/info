/**
 * 空白地帯 - Root Layout
 *
 * このレイアウトはサイト全体を包む「空間」を定義する。
 * すべてのページはこの「空白の器」の中に存在する。
 *
 * コンセプト:
 * - 80%以上の余白を維持
 * - コンテンツは空白の中に「浮かぶ」
 * - 台形マスクによる「グリッドの崩壊」
 */

import type { Metadata, Viewport } from 'next';
import { Noto_Sans_JP } from 'next/font/google';
import './globals.css';

/**
 * フォント設定
 * Noto Sans JPを使用 - 日本語の美しさと可読性を両立
 * weight 300（Light）を基本とし、存在感を抑える
 */
const notoSansJP = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-noto-sans-jp',
  display: 'swap',
});

/**
 * メタデータ
 * SEOよりも「作品としての説明」を重視
 */
export const metadata: Metadata = {
  title: {
    default: '空白地帯',
    template: '%s | 空白地帯',
  },
  description:
    '都市の空白、未完の美学、時間の有限性。このサイトは情報を伝えるためではなく、「空白」を体感させるために存在する。',
  keywords: ['空白', '余白', 'ミニマリズム', '現代美術', 'インスタレーション'],
  authors: [{ name: '空白地帯' }],
  creator: '空白地帯',
  publisher: '空白地帯',
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: 'website',
    locale: 'ja_JP',
    siteName: '空白地帯',
    title: '空白地帯',
    description: '都市の空白、未完の美学、時間の有限性。',
  },
  twitter: {
    card: 'summary',
    title: '空白地帯',
    description: '都市の空白、未完の美学、時間の有限性。',
  },
};

/**
 * ビューポート設定
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FAFAFA',
};

/**
 * Root Layout Component
 *
 * @param children - ページコンテンツ
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={notoSansJP.variable}>
      {/*
        body要素には最小限のスタイルのみ適用。
        「空白」を主役にするため、装飾は行わない。
      */}
      <body className="bg-[var(--color-void)] text-[var(--color-ink)] antialiased" suppressHydrationWarning={true}>
        {/*
          メインコンテンツ領域
          min-h-screenで画面全体を使用し、flexで中央配置可能に。
          ただし、各ページで配置は自由に変更できる。
        */}
        <main className="relative min-h-screen">
          {children}
        </main>

        {/*
          フッター要素は意図的に配置しない。
          「終わり」を示唆する要素は、カウントダウン以外に存在しない。
        */}
      </body>
    </html>
  );
}
