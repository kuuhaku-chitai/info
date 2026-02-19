/**
 * 空白地帯 - 認証ユーティリティ
 *
 * D1 セッションベースの認証。複数管理者対応。
 * パスワードは PBKDF2-SHA256（10万回イテレーション）でハッシュ化。
 * Web Crypto API のみ使用（Cloudflare Workers 互換）。
 *
 * パスワードハッシュ保存形式: pbkdf2:100000:{salt_hex}:{hash_hex}
 */

import { cookies } from 'next/headers';
import type { AdminUser } from '@/types';
import * as db from './db';

// セッション有効期限: 24時間
const SESSION_TTL_SECONDS = 24 * 60 * 60;

// Cookie 名
const COOKIE_NAME = 'admin_session';

// PBKDF2 設定
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';
const SALT_LENGTH = 16; // 128 bits

// ============================================
// パスワードハッシュ（PBKDF2）
// ============================================

/**
 * パスワードを PBKDF2-SHA256 でハッシュ化
 * 返り値: "pbkdf2:100000:{salt_hex}:{hash_hex}"
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await derivePbkdf2(password, salt);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${bufferToHex(salt)}:${bufferToHex(hash)}`;
}

/**
 * パスワードをタイミングセーフに検証
 * 保存形式をパースし、同じ salt + iterations で導出して比較
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1], 10);
  const salt = hexToBuffer(parts[2]);
  const expectedHash = hexToBuffer(parts[3]);

  const derivedHash = await derivePbkdf2(plainPassword, salt, iterations);

  // HMAC 経由のタイミングセーフ比較
  // hex 文字列に変換してからHMACで署名し、バイト単位XORで判定
  const derivedHex = bufferToHex(derivedHash);
  const expectedHex = bufferToHex(expectedHash);

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode('timing-safe-compare'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const sig1 = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(derivedHex)));
  const sig2 = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(expectedHex)));

  return timingSafeEqual(sig1, sig2);
}

// ============================================
// セッション管理（D1）
// ============================================

/**
 * D1 にセッションを作成し、セッション ID を返す
 */
export async function createSession(userId: string): Promise<string> {
  // lazy cleanup: ログイン時に期限切れセッションを掃除
  await db.deleteExpiredSessions();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await db.createDbSession({
    id: sessionId,
    userId,
    expiresAt,
  });

  return sessionId;
}

/**
 * D1 からセッションを削除（ログアウト）
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.deleteDbSession(sessionId);
}

/**
 * 現在のリクエストのセッションからユーザーを取得
 * Server Component / Server Action からのみ呼び出し可能
 * （next/headers の cookies() を使用するため）
 */
export async function getSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(COOKIE_NAME);
  if (!sessionCookie?.value) return null;

  return db.getSessionWithUser(sessionCookie.value);
}

// ============================================
// Cookie ヘルパー
// ============================================

/**
 * セッション Cookie の Set-Cookie ヘッダー値を生成
 */
export function createSessionCookie(sessionId: string, isSecure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${sessionId}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * セッション Cookie 削除用の Set-Cookie ヘッダー値を生成
 */
export function clearSessionCookie(isSecure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0',
  ];
  if (isSecure) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Cookie ヘッダー文字列からセッション ID を抽出
 * （middleware 用: cookies() が使えない場面向け）
 */
export function getSessionCookieValue(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) return null;

  const cookiePairs = cookieHeader.split(';');
  for (const cookie of cookiePairs) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === COOKIE_NAME) {
      const value = valueParts.join('=');
      return value || null;
    }
  }
  return null;
}

// ============================================
// 内部ヘルパー
// ============================================

/** PBKDF2 で鍵導出 */
async function derivePbkdf2(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // salt を ArrayBuffer に変換（TypeScript の Uint8Array ジェネリクス対策）
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;

  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations,
      hash: PBKDF2_HASH,
    },
    keyMaterial,
    256 // 32 bytes
  );

  return new Uint8Array(derived);
}

/** ArrayBuffer / Uint8Array を hex 文字列に変換 */
function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/** hex 文字列を Uint8Array に変換 */
function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * タイミングセーフなバイト列比較
 * XOR で全バイトを比較し、結果を最後にまとめて判定
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
