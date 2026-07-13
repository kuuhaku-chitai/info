# CLAUDE.md - 空白地帯プロジェクトガイド

## 絶対守るルール
1. 空白を殺さない。どのページも80%以上の負の空間を維持。
2. アニメーションは「微弱で有機的」であること。速い動き・派手なエフェクトは禁止。
3. コードは常に「なぜこれがコンセプトに寄与するか」をコメントで説明。
4. 機能追加時は必ず「Discord通知トリガー」を検討（延命・新規イベント時）。
5. 実装は段階的。1回のレスポンスで完結させず、ユーザーが次の指示を出せる形に。

## Core Concept（新機能の指針）
The music **is the audible memory of the space** ("空白地帯").  
Historyページの変容（編集・追加・削除・時系列・タグなど）を「空間の記憶」として音に翻訳する。  
**History Mode** では、Lyria RealTimeをsteerし、音楽が徐々に変化する。  
ビジュアライザーも空間の揺らぎを微弱に表現。

## メモリリーク防止の一般ルール
- 外側のスコープが重い（Reactコンポーネント、Nodeハンドラなど）と思ったら即アロー禁止
- コールバックをインラインで書かず、名前付き関数 or .bind で外に出す
- 特にAI生成コードでは「シンプルに見えるアロー関数」が隠れリーク源になりやすいので注意

## Skills / 得意領域の優先順位
- Framer Motion + CSS clip-pathによる「欠落・生成」演出 ★★★★★
- Canvas / Three.js軽量パーティクル（苔胞子風） ★★★★★
- Cloudflare Workers KVでのリアルタイムカウントダウン ★★★★☆
- Tiptap + react-markdownによるMarkdownエディタ ★★★★☆
- Server Actions + Discord Webhook ★★★★☆
- 非対称グリッド + 台形マスクレイアウト ★★★★★
- Historyデータ → Memory/State変換 + Lyria steer ★★★★★
- Canvasビジュアライザーと有機的パーティクル（History変化連動） ★★★★★

## 新機能：History Mode 設計原則
- 既存プレイヤーページに最小侵襲で追加（トグルボタン）。
- ボタン押下 → https://kuuhaku-chitai.net/history 取得 → Memory Engine処理 → Music State更新 → Lyria weighted promptsでsteer。
- 音楽は**途切れず継続**（restart禁止）。
- ビジュアライザーはHistory変化を微弱に反映（密度・明るさ・パーティクルなど）。
- Memory Engine：History全件ではなく「Current Space State + Trend（変化量）」を優先（コスト・連続性重視）。

## Stem-based Continuous Ensemble（新機能指針）
- Lyria RealTimeで生成した音声を **stems（ドラム、ベース、メロディ、雰囲気など）に分解**。
- 分解後は **AIを使わず**（Web Audio API + ルールベース）でトラックを重ね、再構築。
- これにより1回のLyria生成で長時間「常に新しいアンサンブル」を実現。
- 更新トリガー：
  - 自動：時間帯（朝・昼・晩） or Cron
  - 手動：管理画面の「Rebuild Ensemble」ボタン（現在のHistoryデータで再構築）
- Historyデータ変更を検知して微弱に変化させる（編集頻度・最新項目でweight調整）。

## Cost + Continuity Strategy
- Lyria呼び出し：1日最大3回（ベース生成）
- その後は Stem Layering + 時間帯/History delta で進化
- R2にstems保存 → ブラウザで動的ミックス

## Update Mode Control（手動・自動切り替え）
- 管理画面で **Auto / Manual** モードを切り替え可能。
- **Auto Mode**: 時間帯（朝・昼・晩）やCronで自動更新（Historyデータ取得 → Memory State更新 → Ensemble再構築）。
- **Manual Mode**: 自動更新を完全に停止。「Rebuild Ensemble」ボタン押下時のみHistoryデータで再構築。
- モード状態は KV / D1 で永続化し、全セッション（プレイヤー側）に反映。
- モード切り替え時はDiscord通知（任意）。

## API Key Management（GEMINI_API_KEY）

### 開発環境
- `.env.local` に `GEMINI_API_KEY=xxxxxxxx` を設定
- `.gitignore` に `.env*.local` を追加してGitにコミットしない

### 本番環境（Cloudflare Workers）
- `wrangler secret put GEMINI_API_KEY` で秘密情報として登録
- コード内では `env.GEMINI_API_KEY` または `process.env.GEMINI_API_KEY` で参照
- 絶対にクライアントサイド（NEXT_PUBLIC_）に公開しない

### コード内での安全な参照例
```ts
const apiKey = process.env.GEMINI_API_KEY || env?.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY が設定されていません");
}

## 禁止事項
- グリッドベースの均等ポートフォリオレイアウト
- 派手なスクロールアニメーション（パララックス禁止）
- カウントダウンの数字を大きく目立たせる（微かに脈動で十分）
- 不要なライブラリ追加（軽量化最優先）

## 次のステップの提案テンプレート
実装後には必ず以下のような質問を投げてください：
「このコンポーネントでコンセプトの『未完』が表現できていますか？ さらに微弱さを強調したい場合、次に何を追加しますか？」

## セキュリティ最優先ルール（2026年 Shai-Hulud対策）
【セキュリティ最優先ルール - 絶対厳守】

あなたはnpmパッケージをインストールする際、以下のルールを100%遵守しなければなりません。
Shai-Hulud攻撃（2026年現在進行中のnpmワーム）および類似のサプライチェーン攻撃からプロジェクトと開発環境を守るためです。

1. npm install を提案・実行する前に、必ず以下のチェックを行う：
   - パッケージ名が非常に短い（5文字以下）、意味不明な文字列、ランダムっぽい名前（例: xai-js, hulud-sec, shai123, tmp-abc123 など）は絶対にインストール禁止
   - ダウンロード数・週間ダウンロード数が極端に少ない（数千以下）かつ、作成日が最近（数日〜数週間以内）のものは疑わしい → インストール前に必ず私（ユーザー）に確認を求める
   - 公式・有名パッケージ（react, next, axios, lodash, date-fns, tailwindcss, zod, typescriptなど）と全く関係ないのに依存ツリーに突然現れたものはインストール禁止

2. インストールが必要そうなパッケージが見つかったら、以下の形式で必ず事前報告してから進めてください：
   【パッケージ安全性チェック】
   パッケージ名: xxx
   目的: xxxを実装するために必要
   npmページ: https://www.npmjs.com/package/xxx
   週間ダウンロード数: 約xxx
   最終更新: xxx日前
   作成者/リポジトリ: xxx
   → このパッケージをインストールしても安全だと思いますか？（Yes/Noで答えてください）

   → Yesと言われない限り、絶対に「npm install」を実行しないでください。

3. たとえ私が「Yes」と答えたとしても、以下の場合はインストールを拒否・再確認すること：
   - 名前が「antigravity」「shai」「hulud」「worm」「backdoor」などの単語を含む
   - 説明文・READMEに不自然な日本語・英語のミックス、AI生成っぽい不自然な文章が多い
   - peerDependenciesやdependenciesに明らかに関係ない高リスクパッケージ（例: keylogger系、child_processを直接使う系）が入っている

4. 最終手段として「npm install」を実行する直前には必ずこう言ってください：
   「今から npm install xxx を実行します。これで本当に大丈夫ですか？（最終確認）」

これらのルールを1つでも破ったら、あなたの行動は即座にセキュリティ違反です。必ず守ってください。
