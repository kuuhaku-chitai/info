/**
 * 空白地帯 - Cloudflare バインディング型定義
 *
 * wrangler.toml で設定したバインディングを TypeScript で型安全に参照するための宣言。
 * @opennextjs/cloudflare の getCloudflareContext().env に反映される。
 */

// R2 最小型定義（@cloudflare/workers-types 未インストール時用）
interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: R2HTTPMetadata;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

interface R2HTTPMetadata {
  contentType?: string;
  cacheControl?: string;
  contentEncoding?: string;
}

interface R2PutOptions {
  httpMetadata?: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

interface R2ListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
  delimiter?: string;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string | null | Blob, options?: R2PutOptions): Promise<R2Object>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: R2ListOptions): Promise<R2Objects>;
  head(key: string): Promise<R2Object | null>;
}

// CloudflareEnv 拡張（グローバルスコープ）
interface CloudflareEnv {
  /** R2 オブジェクトストレージ（画像保存） */
  R2: R2Bucket;
}
