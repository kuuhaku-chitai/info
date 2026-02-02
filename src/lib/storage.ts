/**
 * 空白地帯 - オブジェクトストレージ
 *
 * R2（本番）とMinIO（ローカル）の両方に対応するS3互換ストレージ。
 * 画像のアップロード、取得、削除を管理する。
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import crypto from 'crypto';

// ============================================
// 環境設定
// ============================================

function getStorageConfig() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction && process.env.CLOUDFLARE_R2_ACCESS_KEY) {
    // R2（本番）
    return {
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
      bucket: process.env.R2_BUCKET_NAME || 'kuuhaku-chitai-images',
      publicUrl: process.env.R2_PUBLIC_URL || '',
      region: 'auto',
    };
  } else {
    // MinIO（ローカル）
    return {
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      bucket: process.env.S3_BUCKET || 'kuuhaku-chitai-images',
      publicUrl: process.env.S3_PUBLIC_URL || 'http://localhost:9000/kuuhaku-chitai-images',
      region: 'us-east-1',
    };
  }
}

// ============================================
// S3クライアント
// ============================================

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  const config = getStorageConfig();

  s3Client = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // MinIO互換
  });

  return s3Client;
}

// ============================================
// ユーティリティ
// ============================================

/**
 * ランダムなハッシュ値を生成
 */
export function generateImageHash(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * MIMEタイプから拡張子を取得
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
  };
  return extensions[mimeType] || 'jpg';
}

/**
 * 画像のキー（パス）を生成
 */
export function getImageKey(postId: string, filename: string): string {
  return `posts/${postId}/${filename}`;
}

/**
 * 画像の公開URLを取得
 */
export function getImageUrl(postId: string, filename: string): string {
  const config = getStorageConfig();
  const key = getImageKey(postId, filename);

  if (config.publicUrl) {
    return `${config.publicUrl}/${key}`;
  }

  // R2のカスタムドメインを使用する場合
  return `/${key}`;
}

// ============================================
// ストレージ操作
// ============================================

/**
 * 画像をアップロード
 */
export async function uploadImage(
  postId: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ url: string; filename: string; key: string }> {
  const config = getStorageConfig();
  const client = getS3Client();

  // ファイル名を生成
  const hash = generateImageHash();
  const ext = getExtensionFromMimeType(mimeType);
  const filename = `${hash}.${ext}`;
  const key = getImageKey(postId, filename);

  // アップロード
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000', // 1年キャッシュ
    })
  );

  const url = getImageUrl(postId, filename);

  return { url, filename, key };
}

/**
 * 画像を削除
 */
export async function deleteImage(
  postId: string,
  filename: string
): Promise<boolean> {
  const config = getStorageConfig();
  const client = getS3Client();
  const key = getImageKey(postId, filename);

  try {
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    console.error('Failed to delete image:', error);
    return false;
  }
}

/**
 * 投稿に関連するすべての画像を削除
 */
export async function deleteAllPostImages(postId: string): Promise<boolean> {
  const config = getStorageConfig();
  const client = getS3Client();
  const prefix = `posts/${postId}/`;

  try {
    // 画像一覧を取得
    const listResult = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
      })
    );

    if (!listResult.Contents || listResult.Contents.length === 0) {
      return true;
    }

    // 各画像を削除
    for (const object of listResult.Contents) {
      if (object.Key) {
        await client.send(
          new DeleteObjectCommand({
            Bucket: config.bucket,
            Key: object.Key,
          })
        );
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to delete post images:', error);
    return false;
  }
}

/**
 * 投稿の画像一覧を取得
 */
export async function listPostImages(postId: string): Promise<string[]> {
  const config = getStorageConfig();
  const client = getS3Client();
  const prefix = `posts/${postId}/`;

  try {
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: prefix,
      })
    );

    if (!result.Contents) {
      return [];
    }

    return result.Contents
      .filter((obj) => obj.Key)
      .map((obj) => obj.Key!.replace(prefix, ''));
  } catch (error) {
    console.error('Failed to list post images:', error);
    return [];
  }
}

/**
 * 画像が存在するか確認
 */
export async function imageExists(
  postId: string,
  filename: string
): Promise<boolean> {
  const config = getStorageConfig();
  const client = getS3Client();
  const key = getImageKey(postId, filename);

  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    return true;
  } catch {
    return false;
  }
}
