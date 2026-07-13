# 空白地帯 - Kuuhaku Chitai

Next.js 16 + Cloudflare Workers で構築された、時間の消滅を可視化するウェブアプリケーション。

## 必要要件

- **Node.js** 20.x以上
- **pnpm** 9.0.0以上（npm/yarnは非推奨）
- **Docker & Docker Compose**（ローカル開発用）

## セットアップ

### 1. pnpmのインストール

pnpmがインストールされていない場合：

```bash
npm install -g pnpm
```

### 2. 依存関係インストール

```bash
pnpm install
```

### 3. 環境変数設定

`.env.local` ファイルを作成：

```env
# ローカル開発用
NEXT_PUBLIC_BASE_URL=http://localhost:3000
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
RESEND_API_KEY=your_resend_api_key
TURNSTILE_SECRET_KEY=your_turnstile_secret
```

### 4. Docker起動 + DB初期化

```bash
pnpm run setup
```

これにより以下が実行されます：
- MinIO（R2互換ストレージ）の起動
- SQLiteデータベースの初期化

### 5. 開発サーバー起動

```bash
pnpm run dev
```

[http://localhost:3000](http://localhost:3000) にアクセス

## 主要コマンド

| コマンド | 説明 |
|---------|------|
| `pnpm run dev` | 開発サーバー起動 |
| `pnpm run build` | Next.jsビルド |
| `pnpm run build:worker` | Cloudflare Workersビルド |
| `pnpm run deploy` | 本番デプロイ |
| `pnpm run deploy:preview` | プレビュー環境デプロイ |
| `pnpm run db:migrate` | データベースマイグレーション |
| `pnpm run docker:up` | Docker起動 |
| `pnpm run docker:down` | Docker停止 |
| `pnpm run lint` | ESLint実行 |

## デプロイ

Cloudflare Workersへのデプロイ：

```bash
pnpm run deploy
```

## music Mode（空間の記憶を聴く）

/history の変容を Lyria RealTime で音に翻訳し、4つの擬似stemをWeb Audio APIで
重ね直して「常に新しいアンサンブル」を鳴らす機能。
詳細な技術仕様は [docs/music-mode-spec.md](docs/music-mode-spec.md) を参照
（当初の実装計画は [plan.md](plan.md)）。

### 必要なシークレット

| キー | 開発（.env.local） | 本番（wrangler secret put） | 用途 |
|---|---|---|---|
| `GEMINI_API_KEY` | 必須 | 必須 | Lyria RealTime接続（サーバのみ。クライアントへは渡らない） |
| `CRON_SECRET` | 任意 | Autoモード運用時に必須 | Cron→/api/music/rebuild の内部認証。未設定なら自動採取は完全休止 |
| `DISCORD_WEBHOOK_URL` | 任意 | 任意 | 生成・モード切替の通知 |

```bash
wrangler secret put GEMINI_API_KEY
wrangler secret put CRON_SECRET   # 例: openssl rand -hex 32
```

### 本番D1へのマイグレーション

```bash
wrangler d1 execute kuuhaku-chitai-db --remote --file=migrations/0010_add_music.sql
```

### 自動採取（Cron）の仕組み

- `wrangler.toml` の `[triggers] crons = ["0 * * * *"]` で毎時起床
- `worker/index.ts`（カスタムエントリ）が in-process で
  `POST /api/music/rebuild` を Bearer CRON_SECRET 付きで呼ぶ
- サーバ側ガードが「予定時刻（管理画面の朝・昼・晩、時単位）／Autoモード／
  1日3回上限／二重生成ロック」をすべて判定。既定はManualモード＝何も起きない
- preview環境はcrons無効（Lyriaコストは本番のみ）

### 使い方

1. 管理画面「音楽」でモード・テンプレート・スケジュールを管理
2. 「Rebuild Ensemble」で手動採取（Manualモードでも可・1日3回まで）
3. /history 右上の「音」で再生・停止

## コンセプト

「空白地帯」は時間の消滅を可視化するプロジェクトです。詳細は [CLAUDE.md](CLAUDE.md) を参照してください。

## 技術スタック

- **フレームワーク**: Next.js 16 (App Router)
- **デプロイ**: Cloudflare Workers
- **データベース**:
  - 開発: SQLite (better-sqlite3)
  - 本番: Cloudflare D1
- **ストレージ**:
  - 開発: MinIO
  - 本番: Cloudflare R2
- **パッケージマネージャー**: pnpm
- **3Dレンダリング**: Three.js + React Three Fiber
- **アニメーション**: Framer Motion
- **Markdown**: react-markdown + KaTeX

## ライセンス

このプロジェクトは個人プロジェクトです。
