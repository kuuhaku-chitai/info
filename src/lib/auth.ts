/**
 * 空白地帯 - 認証ユーティリティ
 *
 * Cloudflare Workers 互換のステートレスセッション認証。
 * Web Crypto API のみを使用（bcrypt/argon2 は Workers で使用不可）。
 *
 * セッショントークン形式: {expiresAt_unix}.{hmac_hex}
 * - expiresAt: UNIX タイムスタンプ（秒）
 * - hmac: expiresAt を SESSION_SECRET で HMAC-SHA256 署名した hex 文字列
 */

// セッション有効期限: 24時間
const SESSION_TTL_SECONDS = 24 * 60 * 60;

// Cookie 名
const COOKIE_NAME = 'admin_session';

// --- パスワード関連 ---

/**
 * パスワードを SHA-256 でハッシュ化（hex 文字列で返す）
 * 初期パスワードハッシュ生成時に使用。
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bufferToHex(hashBuffer);
}

/**
 * パスワードをタイミングセーフに検証
 *
 * 直接の文字列比較はタイミング攻撃に脆弱なため、
 * HMAC を経由して一定時間で比較する。
 * 原理: HMAC(key, plainHash) === HMAC(key, storedHash) をバイト単位 XOR で比較
 */
export async function verifyPassword(
  plainPassword: string,
  storedHash: string,
  secret: string
): Promise<boolean> {
  const plainHash = await hashPassword(plainPassword);

  // HMAC 署名を使って一定時間比較を実現
  const key = await importHmacKey(secret);
  const encoder = new TextEncoder();

  const sig1 = await crypto.subtle.sign('HMAC', key, encoder.encode(plainHash));
  const sig2 = await crypto.subtle.sign('HMAC', key, encoder.encode(storedHash));

  return timingSafeEqual(new Uint8Array(sig1), new Uint8Array(sig2));
}

// --- セッショントークン ---

/**
 * セッショントークンを生成
 * 形式: {expiresAt}.{hmac_hex}
 */
export async function createSessionToken(secret: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const key = await importHmacKey(secret);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(String(expiresAt))
  );
  const hmacHex = bufferToHex(signature);
  return `${expiresAt}.${hmacHex}`;
}

/**
 * セッショントークンを検証
 * - HMAC 署名が正しいか
 * - 有効期限内か
 */
export async function verifySessionToken(
  token: string,
  secret: string
): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const expiresAtStr = token.substring(0, dotIndex);
  const providedHmac = token.substring(dotIndex + 1);

  // 有効期限チェック
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt)) return false;
  if (Math.floor(Date.now() / 1000) > expiresAt) return false;

  // HMAC 検証（タイミングセーフ）
  const key = await importHmacKey(secret);
  const encoder = new TextEncoder();
  const expectedSig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(expiresAtStr)
  );
  const expectedHex = bufferToHex(expectedSig);

  // HMAC 同士をさらに HMAC で比較（タイミングセーフ）
  const sig1 = await crypto.subtle.sign('HMAC', key, encoder.encode(providedHmac));
  const sig2 = await crypto.subtle.sign('HMAC', key, encoder.encode(expectedHex));

  return timingSafeEqual(new Uint8Array(sig1), new Uint8Array(sig2));
}

// --- Cookie ---

/**
 * セッション Cookie の Set-Cookie ヘッダー値を生成
 */
export function createSessionCookie(token: string, isSecure: boolean): string {
  const parts = [
    `${COOKIE_NAME}=${token}`,
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
 * Cookie ヘッダーからセッショントークンを抽出
 */
export function getSessionCookieValue(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === COOKIE_NAME) {
      const value = valueParts.join('=');
      return value || null;
    }
  }
  return null;
}

// --- 内部ヘルパー ---

/** HMAC-SHA256 キーをインポート */
async function importHmacKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

/** ArrayBuffer を hex 文字列に変換 */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * タイミングセーフなバイト列比較
 * XOR で全バイトを比較し、結果を最後にまとめて判定。
 */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
