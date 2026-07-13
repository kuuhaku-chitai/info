# plan.md — Music Mode（空間の記憶を聴く）実装計画

> The music **is the audible memory of the space**.
> Historyページの変容（コミット・分岐・合流・記憶）を「空間の記憶」として音に翻訳する。
> 音は主張しない。空白の80%を侵さない、微弱で有機的な持続音。

---

## 1. アーキテクチャ概要

```
                        ┌─────────────────────────────────────────┐
                        │  管理画面 /admin/music                    │
                        │  ・Auto / Manual 切替（デフォルト: Manual）│
                        │  ・プロンプトテンプレート管理               │
                        │  ・スケジュール設定（朝・昼・晩）           │
                        │  ・Rebuild Ensemble ボタン                │
                        │  ・使用ログ閲覧                           │
                        └───────────────┬─────────────────────────┘
                                        │ Server Actions（認証済み）
                                        ▼
┌──────────────┐   ①取得    ┌──────────────────────────┐
│ History DB    │──────────▶│ Memory Engine（純粋関数）   │
│ (D1)          │           │ VersionGraph → MusicState  │
│ version_      │           │ 全件ではなく                │
│ records 等    │           │ Current State + Trend 優先  │
└──────────────┘           └────────────┬─────────────┘
                                        │ ②weighted prompts生成
                                        ▼
        Cron Trigger（Auto時のみ、       ┌──────────────────────────┐
        1日最大3回 朝/昼/晩）───────────▶│ Lyria RealTime Session    │
        Rebuild ボタン（Manual）─────────▶│ apiVersion: v1alpha       │
                                        │ models/lyria-realtime-exp │
                                        │ 1セッションでsteerしながら  │
                                        │ 4テクスチャを順次キャプチャ  │
                                        └────────────┬─────────────┘
                                        ③PCM→WAV encode
                                                     ▼
                                        ┌──────────────────────────┐
                                        │ R2: music/stems/          │
                                        │ rhythm / bass / melody /  │
                                        │ atmosphere（擬似stems）    │
                                        │ + manifest.json (D1参照)  │
                                        └────────────┬─────────────┘
                                        ④manifest配信（公開API）
                                                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ /history ページ（クライアント）                                     │
│ ・「music Mode」トグル（隅に微弱に佇む）                             │
│ ・Web Audio API Ensemble Engine（AI不使用・ルールベース）            │
│    - 4 stems を独立ループ再生（ループ開始オフセットをランダム化）       │
│    - ゲインLFO / バンドフィルタ / 時間帯ルールで常に新しい重なり        │
│    - 音は途切れない（stem差し替えはクロスフェード）                    │
│ ・AnalyserNode → HistoryGraph へ微弱に連動（密度・明度の揺らぎ）       │
└─────────────────────────────────────────────────────────────────┘
```

### なぜこの構成か（コンセプトへの寄与）
- **Lyriaは「記憶の採取」にのみ使う**（1日最大3回）。日常の音はブラウザ内の
  ルールベース再構築で無限に変化する——「一度の生成が長く生き続ける」ことが
  空白地帯の延命コンセプトと呼応する。
- Lyriaは真のstem分離を提供しないため、**1セッション内でweighted promptsを
  steerし、リズム寄り→ベース寄り→旋律寄り→空気感の4区間を順にキャプチャ**して
  擬似stemsとする（restartせず連続、CLAUDE.md「途切れず継続」を生成段階でも遵守）。
- モード状態・ログ・テンプレートは **D1で永続化**（既存バインディングを活用、
  新規KV追加なし＝軽量化最優先）。音声ファイルは既存R2バケットに保存。

---

## 2. 新規 / 変更ファイル一覧

### 新規
| ファイル | 役割 |
|---|---|
| `migrations/0010_add_music.sql` | music_settings / music_prompt_templates / music_generation_log / music_stems テーブル |
| `src/types/music.ts` | MusicState / StemManifest / MusicSettings / GenerationLog 等の型 |
| `src/lib/music/memoryEngine.ts` | VersionGraph → MusicState → weighted prompts（純粋関数・AI不使用） |
| `src/lib/music/lyria.ts` | Lyria RealTimeセッション管理（v1alpha / lyria-realtime-exp）、PCM収集→WAVエンコード→R2保存 |
| `src/lib/music/guard.ts` | 使用回数ガード（1日3回上限・モード判定・ロック） |
| `src/app/api/music/manifest/route.ts` | 公開API：現在のstemマニフェスト＋MusicState（クライアント再生用） |
| `src/app/api/music/rebuild/route.ts` | 認証API：Rebuild Ensemble（Manual時の手動再構築、Cronからも共用） |
| `src/components/music/MusicModeToggle.tsx` | /history 隅の「music Mode」トグル（微弱・脈動のみ） |
| `src/components/music/useEnsemble.ts` | Web Audio API Ensemble Engine（stemレイヤリング・ルールベース進化） |
| `src/components/music/ensembleRules.ts` | 時間帯 / History delta によるミックスルール（名前付き関数で分離） |
| `src/app/admin/(dashboard)/music/page.tsx` | 管理画面：モード切替・テンプレート・スケジュール・ログ・Rebuildボタン |
| `worker/index.ts` | OpenNext workerをラップし `scheduled` ハンドラ（Cron）を追加するカスタムエントリ |

### 変更
| ファイル | 変更内容 |
|---|---|
| `src/app/history/page.tsx` | MusicModeToggle を配置（最小侵襲） |
| `src/components/history/HistoryGraph.tsx` | AnalyserNodeの値を受けて微弱連動（opacity/密度の揺らぎのみ） |
| `src/components/history/historyStore.ts` | musicMode状態・audio energy値の共有（zustand既存ストアに追加） |
| `src/lib/actions.ts` | 音楽設定・テンプレート・ログ用Server Actions追加 |
| `src/lib/db.ts` | 新テーブルのクエリ関数追加 |
| `src/lib/discord.ts` | `notifyMusicEvent`（モード切替・生成成功/失敗・上限到達）追加 |
| `src/app/admin/(dashboard)/layout.tsx` | ナビに「音楽」リンク追加 |
| `wrangler.toml` | `[triggers] crons`（朝/昼/晩 JST）＋ `main` をカスタムworkerに変更 |
| `package.json` | `@google/genai` 追加（※下記セキュリティチェック後） |
| `.env.local` / wrangler secret | `GEMINI_API_KEY`（コード変更なし、手順のみ） |

### 【パッケージ安全性チェック】（インストール前にユーザー承認必須）
- パッケージ名: `@google/genai`
- 目的: Lyria RealTime（live.music.connect）への公式SDK接続に必要
- npmページ: https://www.npmjs.com/package/@google/genai
- 週間ダウンロード数: 数百万（Google公式）
- 作成者/リポジトリ: Google / googleapis/js-genai
- → **Yesの回答があるまで npm install は実行しない。** 代替案：SDKを使わず
  WebSocketを直接叩く実装も可能（依存ゼロ。ただしプロトコル追従コストあり）。

---

## 3. タスク分解（段階的実装順）

1回のレスポンス＝1ステップ。各ステップ後にユーザーが方向修正できる。

| Step | 内容 | 依存 |
|---|---|---|
| **1** | DBマイグレーション `0010_add_music.sql` ＋ `src/types/music.ts`。モードのデフォルトは `manual` をSQLで保証 | なし |
| **2** | **Memory Engine**：`fetchVersionGraph()` の結果を MusicState（密度・変化量Trend・分岐活性・キーワード）に変換し weighted prompts を出す純粋関数。AI不使用・単体で検証可能 | 1 |
| **3** | **Lyria生成層**：`lyria.ts`＋`guard.ts`。1日3回ガード→セッション接続→steerで4擬似stemキャプチャ→WAV化→R2保存→D1にmanifest記録。（`@google/genai` 承認ゲートあり） | 1,2 |
| **4** | **API**：`/api/music/manifest`（公開・キャッシュ付き）と `/api/music/rebuild`（既存auth必須） | 3 |
| **5** | **クライアント再生**：`useEnsemble.ts`＋`ensembleRules.ts`＋`MusicModeToggle.tsx`。/historyへ配置。ユーザー操作でAudioContext開始（自動再生制約準拠）、途切れないレイヤリング | 4 |
| **6** | **ビジュアライザー連動**：AnalyserNode→historyStore→HistoryGraphの微弱な揺らぎ（禁止事項に抵触しない振幅に制限） | 5 |
| **7** | **管理画面** `/admin/music`：Auto/Manual切替（D1永続化・全セッション反映）、プロンプトテンプレートCRUD、スケジュール設定、使用ログ、Rebuild Ensembleボタン、切替時Discord通知 | 4 |
| **8** | **Cron配線**：カスタムworkerエントリ＋`[triggers] crons`（JST 朝07/昼12/晩19 → UTC 22,3,10）。Auto時のみ実行、Manual時は完全スキップ。デプロイ手順・secret登録手順をREADMEに追記 | 3,7 |

> リスク注記（Step 8）：OpenNextのworker出力に `scheduled` を足すカスタム
> エントリはビルド検証が必要。不調時のフォールバックは「外部スケジューラから
> `/api/music/rebuild` を認証付きで叩く」方式（コード変更最小）。

---

## 4. コスト対策と安全性

### コスト（Lyria使用ポリシー）
- **1日最大3回**：`music_generation_log` を日付でカウントし、Cron・手動どちらの
  経路でも**サーバ側で強制**（UIの無効化だけに頼らない）。
- **Manualがデフォルト**：初期状態では自動生成は一切走らない。
- **セッション時間上限**：1回の生成は合計 約3〜4分のキャプチャで打ち切り
  （4 stems × 45〜60秒）。タイムアウトで必ずclose。
- **再生はゼロコスト**：R2のstemsをブラウザが混ぜるだけ。Lyriaは再生に関与しない。
- **同時実行ロック**：生成中フラグをD1に持ち、二重生成を防止。
- 上限到達・生成失敗はDiscord通知（既存 `discord.ts` を拡張）。

### 安全性
- `GEMINI_API_KEY` はサーバのみ：開発は `.env.local`（`.env*.local` はgitignore済み
  であることを確認）、本番は `wrangler secret put GEMINI_API_KEY`。
  `NEXT_PUBLIC_` には絶対に載せない。クライアントに渡るのはR2のURLとmanifestのみ。
- `/api/music/rebuild` と管理画面は既存の認証（`src/lib/auth.ts`）で保護。
- プロンプトテンプレートはサーバ側で長さ・文字種を検証（injection的な巨大入力を拒否）。
- 新規依存は `@google/genai` のみ（承認制）。それ以外のライブラリ追加はしない。
- メモリリーク対策：AudioNode群・WebSocket・intervalは名前付き関数でcleanupを
  実装（インラインアロー禁止ルール遵守）。ページ離脱時に必ず `close()`。

### 音のコンセプト保護（禁止事項との整合）
- music Modeトグルは隅に小さく、微かな脈動のみ。大きなプレイヤーUIは作らない。
- ミックスルールは「常に1〜2 stemは休む」＝音にも負の空間を残す。
- ビジュアライザー連動は振幅上限を設け、派手なエフェクトにならないよう定数で制限。
