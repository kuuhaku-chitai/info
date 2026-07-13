-- Music Mode（空間の記憶を聴く）テーブル群
--
-- Historyページの変容を「空間の記憶」として音に翻訳するための永続層。
-- Lyria RealTimeの呼び出しは高コストなため、生成の記録・上限管理・
-- モード制御をすべてD1側で強制する（UIの無効化だけに頼らない）。
--   music_settings         … 更新モード（Auto/Manual）と同時実行ロック（単一行）
--   music_prompt_templates … 擬似stem別のプロンプトテンプレート（管理画面でCRUD）
--   music_generation_log   … Lyria呼び出しの使用ログ（1日3回上限のカウント根拠）
--   music_stems            … 生成済みstemのR2メタデータ（現行アンサンブルのmanifest）

-- ============================================
-- 更新モード設定（単一行テーブル）
--   CHECK (id = 1) で行を1つに固定し、全セッションが同じ状態を参照する。
--   デフォルトは 'manual' ＝ 初期状態では自動生成は一切走らない（コスト安全側）。
-- ============================================
CREATE TABLE music_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'manual' CHECK (mode IN ('auto', 'manual')),
  -- Auto時の生成時刻（JST, "HH:MM"）。Cronは固定でも、実行時にこの値と照合して
  -- 管理画面からの調整を反映できるようにする。
  schedule_morning TEXT NOT NULL DEFAULT '07:00',
  schedule_noon TEXT NOT NULL DEFAULT '12:00',
  schedule_evening TEXT NOT NULL DEFAULT '19:00',
  -- 同時実行ロック。生成中に二重でLyriaセッションを張らないための旗。
  is_generating INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO music_settings (id, mode) VALUES (1, 'manual');

-- ============================================
-- プロンプトテンプレート（擬似stem別）
--   Lyriaは真のstem分離を提供しないため、1セッション内でweighted promptsを
--   steerし、4つの音色域（rhythm/bass/melody/atmosphere）を順にキャプチャする。
--   その各区間の「性格」を決めるのがこのテンプレート。
--   {keywords} {density} {trend} のプレースホルダをMemory Engineが実値で置換する。
-- ============================================
CREATE TABLE music_prompt_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stem_role TEXT NOT NULL CHECK (stem_role IN ('rhythm', 'bass', 'melody', 'atmosphere')),
  template TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_music_prompt_templates_role ON music_prompt_templates(stem_role, is_active);

-- 初期テンプレート：音にも「負の空間」を残す、微弱で有機的な指定。
-- 派手さを禁じる形容詞（sparse / faint / slow）をデフォルトに焼き込むことで、
-- テンプレートを編集しない限りコンセプトから逸脱しない。
INSERT INTO music_prompt_templates (id, name, stem_role, template, sort_order) VALUES
  ('tpl-rhythm-default', '微かな律動', 'rhythm',
   'sparse organic percussion, faint wooden taps, slow heartbeat pulse, {density}', 0),
  ('tpl-bass-default', '地の底の記憶', 'bass',
   'deep sustained sub bass drone, barely moving, warm and dark, {trend}', 1),
  ('tpl-melody-default', '断片の旋律', 'melody',
   'fragmented minimal piano phrases, long silences between notes, {keywords}', 2),
  ('tpl-atmosphere-default', '空白の空気', 'atmosphere',
   'airy ambient texture, moss and dust, distant room tone, hollow space, {keywords}', 3);

-- ============================================
-- 生成ログ（コスト管理の根拠）
--   「1日最大3回」はこのテーブルの当日成功件数をサーバ側でカウントして強制する。
--   失敗・スキップも記録し、管理画面の使用ログとDiscord通知の材料にする。
-- ============================================
CREATE TABLE music_generation_log (
  id TEXT PRIMARY KEY,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('auto', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'skipped')),
  -- 生成時点のMusicStateスナップショット（JSON）。後から「なぜこの音だったか」を辿れる。
  music_state TEXT,
  -- 実際にLyriaへ送ったweighted prompts（JSON）。テンプレート改善の材料。
  prompts TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_music_generation_log_created_at ON music_generation_log(created_at);
CREATE INDEX idx_music_generation_log_status ON music_generation_log(status, created_at);

-- ============================================
-- 生成済みstem（R2メタデータ / 現行アンサンブルのmanifest）
--   is_current = 1 の4行が「いま鳴っているアンサンブル」。
--   再生はR2から配信するだけなのでLyriaコストはゼロ。
--   過去世代は差し替え時にis_current=0となり、掃除は後続タスクで検討する。
-- ============================================
CREATE TABLE music_stems (
  id TEXT PRIMARY KEY,
  generation_id TEXT NOT NULL REFERENCES music_generation_log(id) ON DELETE CASCADE,
  stem_role TEXT NOT NULL CHECK (stem_role IN ('rhythm', 'bass', 'melody', 'atmosphere')),
  r2_key TEXT NOT NULL,
  url TEXT NOT NULL,
  duration_sec REAL NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_music_stems_current ON music_stems(is_current, stem_role);
CREATE INDEX idx_music_stems_generation ON music_stems(generation_id);
