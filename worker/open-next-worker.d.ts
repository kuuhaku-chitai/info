/**
 * 空白地帯 - OpenNextビルド出力（.open-next/worker.js）の型宣言
 *
 * ビルド出力はJSで型を持たないため、カスタムエントリ（index.ts）が
 * 安全にimportできる最小限の形をここで宣言する。
 * `.open-next` が未ビルドの環境でもtscが通るようワイルドカードで束ねる。
 */

declare module '*/.open-next/worker.js' {
  interface OpenNextHandler {
    fetch(request: Request, env: unknown, ctx: unknown): Promise<Response>;
  }
  const handler: OpenNextHandler;
  export default handler;
  // OpenNextが生成するDurable Objectクラス（wranglerが名前で参照する）
  export class DOQueueHandler {}
  export class DOShardedTagCache {}
  export class BucketCachePurge {}
}
