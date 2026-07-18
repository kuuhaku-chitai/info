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
import {
  getCurrentStems,
  getLatestMusicState,
  getRecentGenerationsWithStems,
} from '@/lib/music/musicDb';
import type { StemManifest } from '@/types';

// DBの現在状態を返すため、ビルド時の静的化を禁止する
export const dynamic = 'force-dynamic';

/**
 * 記憶の地層としてmanifestに載せる世代数の上限。
 * URLメタデータのみなのでレスポンスは軽いが、
 * 章（Chapter）の選択肢として意味のある深さに絞る。
 */
const STRATA_GENERATIONS_LIMIT = 8;

export async function GET() {
  try {
    const [stems, musicState, generations] = await Promise.all([
      getCurrentStems(),
      getLatestMusicState(),
      getRecentGenerationsWithStems(STRATA_GENERATIONS_LIMIT),
    ]);

    const manifest: StemManifest = {
      stems,
      musicState,
      generatedAt: stems[0]?.createdAt ?? null,
      // 記憶の地層：直近N世代（現行世代も含む。クライアント側で
      // 現行のgenerationIdを除外して「過去」として扱う）
      generations,
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
