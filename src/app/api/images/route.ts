/**
 * 空白地帯 - 画像アップロードAPI
 *
 * POST: 画像をR2/MinIOにアップロード
 * DELETE: 画像を削除
 */

import { NextRequest, NextResponse } from 'next/server';
import { uploadImage, deleteImage } from '@/lib/storage';

// 許可するMIMEタイプ
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

// 最大ファイルサイズ（10MB）
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 画像アップロード
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const postId = formData.get('postId') as string | null;

    // バリデーション
    if (!file) {
      return NextResponse.json(
        { error: 'ファイルが指定されていません' },
        { status: 400 }
      );
    }

    if (!postId) {
      return NextResponse.json(
        { error: '投稿IDが指定されていません' },
        { status: 400 }
      );
    }

    // MIMEタイプチェック
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: '許可されていないファイル形式です' },
        { status: 400 }
      );
    }

    // ファイルサイズチェック
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'ファイルサイズが大きすぎます（最大10MB）' },
        { status: 400 }
      );
    }

    // ファイルをUint8Arrayに変換（R2バインディング + S3 SDK 両対応）
    const arrayBuffer = await file.arrayBuffer();
    const body = new Uint8Array(arrayBuffer);

    // R2/MinIOに画像を保存
    const result = await uploadImage(postId, body, file.type);

    return NextResponse.json({
      success: true,
      url: result.url,
      filename: result.filename,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: '画像のアップロードに失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * 画像削除
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get('postId');
    const filename = searchParams.get('filename');

    // バリデーション
    if (!postId || !filename) {
      return NextResponse.json(
        { error: 'postIdとfilenameが必要です' },
        { status: 400 }
      );
    }

    // パストラバーサル対策
    if (filename.includes('/') || filename.includes('..')) {
      return NextResponse.json(
        { error: '無効なファイル名です' },
        { status: 400 }
      );
    }

    const result = await deleteImage(postId, filename);

    if (result) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json(
        { error: '画像が見つかりません' },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Image delete error:', error);
    return NextResponse.json(
      { error: '画像の削除に失敗しました' },
      { status: 500 }
    );
  }
}
