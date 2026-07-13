/**
 * 空白地帯 - 現行アンサンブルmanifest API
 *
 * GET /api/music/manifest（公開・認証不要）
 *
 * プレイヤー（/historyのmusic Mode）が音を組み立てるための情報だけを返す：
 * R2上のstem URL・MusicState・生成時刻。
 * GEMINI_API_KEYもプロンプトテンプレートも含まない——
 * クライアントに渡るのは「聴くために必要な最小限」のみ。
 *
 * stemsが空（まだ一度も採取していない）でも200で空のmanifestを返す。
 * 音が無いことはエラーではない。それも空白のひとつの状態。
 */

import { NextResponse } from 'next/server';
import { getCurrentStems, getLatestMusicState } from '@/lib/music/musicDb';
import type { StemManifest } from '@/types';

// DBの現在状態を返すため、ビルド時の静的化を禁止する
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [stems, musicState] = await Promise.all([
      getCurrentStems(),
      getLatestMusicState(),
    ]);

    const manifest: StemManifest = {
      stems,
      musicState,
      generatedAt: stems[0]?.createdAt ?? null,
    };

    return NextResponse.json(manifest, {
      headers: {
        // 生成は1日最大3回なので60秒キャッシュで十分新鮮。
        // プレイヤーのポーリングがD1を叩き続けないための緩衝でもある
        'Cache-Control': 'public, max-age=60',
      },
    });
  } catch (error) {
    console.error('[music/manifest] 取得失敗:', error);
    return NextResponse.json(
      { error: 'manifestの取得に失敗しました' },
      { status: 500 },
    );
  }
}
