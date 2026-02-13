/**
 * 空白地帯 - オブジェクトストレージ
 *
 * R2（本番）とMinIO（ローカル）の両方に対応。
 * 本番: R2バインディング（Cloudflare Workers ネイティブ API）
 * 開発: MinIO（S3互換APIクライアント）
 *
 * 画像パス: posts/{postId}/{uuid}.{ext}
 * - postId ごとのフォルダで投稿単位の一覧/一括削除を維持
 * - crypto.randomUUID() で完全一意（122bit のランダム性）
 */

// ============================================
// 環境判定
// ============================================

const isProduction = process.env.NODE_ENV === 'production';

// ============================================
// ユーティリティ
// ============================================

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
  const key = getImageKey(postId, filename);
  const publicUrl = isProduction
    ? (process.env.R2_PUBLIC_URL || '')
    : (process.env.S3_PUBLIC_URL || '/images');
  return publicUrl ? `${publicUrl}/${key}` : `/${key}`;
}

// ============================================
// R2 バインディング（本番用）
// ============================================

/**
 * R2バインディングを取得
 * getCloudflareContext() は Workers ランタイムでのみ利用可能
 */
async function getR2Bucket(): Promise<R2Bucket> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const { env } = getCloudflareContext();
  return env.R2 as R2Bucket;
}

async function uploadImageR2(
  key: string,
  body: Uint8Array,
  mimeType: string
): Promise<void> {
  const bucket = await getR2Bucket();
  await bucket.put(key, body, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
    },
  });
}

async function deleteImageR2(key: string): Promise<void> {
  const bucket = await getR2Bucket();
  await bucket.delete(key);
}

async function listImagesR2(prefix: string): Promise<string[]> {
  const bucket = await getR2Bucket();
  const result = await bucket.list({ prefix });
  return result.objects.map((obj) => obj.key.replace(prefix, ''));
}

async function imageExistsR2(key: string): Promise<boolean> {
  const bucket = await getR2Bucket();
  const obj = await bucket.head(key);
  return obj !== null;
}

// ============================================
// S3 SDK（ローカル MinIO 用）
// ============================================

let s3ClientInstance: import('@aws-sdk/client-s3').S3Client | null = null;

function getLocalConfig() {
  return {
    endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
    accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
    bucket: process.env.S3_BUCKET || 'kuuhaku-chitai-images',
    region: 'us-east-1',
  };
}

async function getS3Client(): Promise<import('@aws-sdk/client-s3').S3Client> {
  if (s3ClientInstance) return s3ClientInstance;

  const { S3Client } = await import('@aws-sdk/client-s3');
  const config = getLocalConfig();

  s3ClientInstance = new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });

  return s3ClientInstance;
}

async function uploadImageS3(
  key: string,
  body: Uint8Array,
  mimeType: string
): Promise<void> {
  const { PutObjectCommand } = await import('@aws-sdk/client-s3');
  const config = getLocalConfig();
  const client = await getS3Client();

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
      CacheControl: 'public, max-age=31536000',
    })
  );
}

async function deleteImageS3(key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const config = getLocalConfig();
  const client = await getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
}

async function listImagesS3(prefix: string): Promise<string[]> {
  const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');
  const config = getLocalConfig();
  const client = await getS3Client();

  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: config.bucket,
      Prefix: prefix,
    })
  );

  if (!result.Contents) return [];
  return result.Contents
    .filter((obj) => obj.Key)
    .map((obj) => obj.Key!.replace(prefix, ''));
}

async function imageExistsS3(key: string): Promise<boolean> {
  const { HeadObjectCommand } = await import('@aws-sdk/client-s3');
  const config = getLocalConfig();
  const client = await getS3Client();

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

// ============================================
// 統合ストレージ操作
// ============================================

/**
 * 画像をアップロード
 * ファイル名は crypto.randomUUID() で一意に生成
 */
export async function uploadImage(
  postId: string,
  body: Uint8Array,
  mimeType: string
): Promise<{ url: string; filename: string; key: string }> {
  const ext = getExtensionFromMimeType(mimeType);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const key = getImageKey(postId, filename);

  if (isProduction) {
    await uploadImageR2(key, body, mimeType);
  } else {
    await uploadImageS3(key, body, mimeType);
  }

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
  const key = getImageKey(postId, filename);

  try {
    if (isProduction) {
      await deleteImageR2(key);
    } else {
      await deleteImageS3(key);
    }
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
  const prefix = `posts/${postId}/`;

  try {
    const filenames = isProduction
      ? await listImagesR2(prefix)
      : await listImagesS3(prefix);

    if (filenames.length === 0) return true;

    for (const filename of filenames) {
      const key = `${prefix}${filename}`;
      if (isProduction) {
        await deleteImageR2(key);
      } else {
        await deleteImageS3(key);
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
  const prefix = `posts/${postId}/`;

  try {
    return isProduction
      ? await listImagesR2(prefix)
      : await listImagesS3(prefix);
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
  const key = getImageKey(postId, filename);

  try {
    return isProduction
      ? await imageExistsR2(key)
      : await imageExistsS3(key);
  } catch {
    return false;
  }
}
