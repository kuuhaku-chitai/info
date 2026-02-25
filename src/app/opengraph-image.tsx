/**
 * 空白地帯 - デフォルトOG画像
 *
 * Next.jsのファイルベースMetadata APIで自動的にog:imageタグが生成される。
 * 「空白」のコンセプトに忠実な、ほぼ白い1200x630の画像。
 * テキストは極限まで薄く、存在を主張しない。
 */

import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '空白地帯';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FAFAFA',
        }}
      >
        {/* サイト名 — 消えかけた存在感 */}
        <div
          style={{
            fontSize: 48,
            fontWeight: 300,
            letterSpacing: '0.5em',
            color: 'rgba(0, 0, 0, 0.12)',
          }}
        >
          空白地帯
        </div>
        {/* サブテキスト — さらに薄く */}
        <div
          style={{
            fontSize: 16,
            fontWeight: 300,
            letterSpacing: '0.3em',
            color: 'rgba(0, 0, 0, 0.06)',
            marginTop: 24,
          }}
        >
          都市の空白、未完の美学、時間の有限性。
        </div>
      </div>
    ),
    { ...size },
  );
}
