/**
 * 空白地帯 - 画像ユーティリティ
 *
 * 画像のアップロード、圧縮、削除を管理する。
 * 画像は投稿IDごとのディレクトリに保存され、
 * ファイル名はランダムなハッシュ値となる。
 */

import { writeFile, mkdir, unlink, readdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

// 画像保存先のベースパス
const UPLOADS_BASE_PATH = path.join(process.cwd(), 'public', 'uploads');

/**
 * ランダムなハッシュ値を生成
 * @param length ハッシュの長さ（デフォルト: 16）
 */
export function generateImageHash(length: number = 16): string {
  return crypto.randomBytes(length).toString('hex').slice(0, length);
}

/**
 * 画像の拡張子を取得
 * @param mimeType MIMEタイプ
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
 * 投稿用のディレクトリパスを取得
 * @param postId 投稿ID
 */
export function getPostUploadsPath(postId: string): string {
  return path.join(UPLOADS_BASE_PATH, postId);
}

/**
 * 画像のURL（公開パス）を取得
 * @param postId 投稿ID
 * @param filename ファイル名
 */
export function getImageUrl(postId: string, filename: string): string {
  return `/uploads/${postId}/${filename}`;
}

/**
 * 投稿用のディレクトリを作成
 * @param postId 投稿ID
 */
export async function ensurePostUploadsDir(postId: string): Promise<string> {
  const dirPath = getPostUploadsPath(postId);
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * 画像を保存
 * @param postId 投稿ID
 * @param buffer 画像データ
 * @param mimeType MIMEタイプ
 * @returns 保存された画像のURL
 */
export async function saveImage(
  postId: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ url: string; filename: string }> {
  // ディレクトリを確保
  const dirPath = await ensurePostUploadsDir(postId);

  // ファイル名を生成
  const hash = generateImageHash();
  const ext = getExtensionFromMimeType(mimeType);
  const filename = `${hash}.${ext}`;
  const filePath = path.join(dirPath, filename);

  // ファイルを保存
  await writeFile(filePath, buffer);

  // URLを返す
  const url = getImageUrl(postId, filename);
  return { url, filename };
}

/**
 * 画像を削除
 * @param postId 投稿ID
 * @param filename ファイル名
 */
export async function deleteImage(postId: string, filename: string): Promise<boolean> {
  const filePath = path.join(getPostUploadsPath(postId), filename);

  try {
    if (existsSync(filePath)) {
      await unlink(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete image:', error);
    return false;
  }
}

/**
 * 投稿に関連するすべての画像を削除
 * @param postId 投稿ID
 */
export async function deleteAllPostImages(postId: string): Promise<boolean> {
  const dirPath = getPostUploadsPath(postId);

  try {
    if (existsSync(dirPath)) {
      await rm(dirPath, { recursive: true });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete post images:', error);
    return false;
  }
}

/**
 * 投稿の画像一覧を取得
 * @param postId 投稿ID
 */
export async function listPostImages(postId: string): Promise<string[]> {
  const dirPath = getPostUploadsPath(postId);

  try {
    if (!existsSync(dirPath)) {
      return [];
    }
    const files = await readdir(dirPath);
    return files.filter((file) =>
      /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
    );
  } catch (error) {
    console.error('Failed to list post images:', error);
    return [];
  }
}
