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
