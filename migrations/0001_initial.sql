-- 空白地帯 - D1データベーススキーマ
--
-- このスキーマは「寿命」「投稿」「入金」を管理する。
-- すべてのデータは「消えゆく」前提で設計されている。

-- ============================================
-- カウントダウン状態テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS countdown (
  id INTEGER PRIMARY KEY DEFAULT 1,
  start_date TEXT NOT NULL,
  initial_total_seconds INTEGER NOT NULL,
  added_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  -- 単一行を保証
  CHECK (id = 1)
);

-- 初期データ（プロジェクト開始日: 2025-02-01）
INSERT OR IGNORE INTO countdown (id, start_date, initial_total_seconds, added_seconds, updated_at)
VALUES (1, '2025-02-01T00:00:00.000Z', 75587250, 0, '2025-02-01T00:00:00.000Z');

-- ============================================
-- 投稿テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  markdown TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('event', 'article', 'note', 'news')),
  tags TEXT NOT NULL DEFAULT '[]',  -- JSON配列として保存
  is_published INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  event_start_date TEXT,
  event_end_date TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_is_published ON posts(is_published);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);

-- ============================================
-- 入金テーブル
-- ============================================
CREATE TABLE IF NOT EXISTS donations (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  added_seconds INTEGER NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_donations_date ON donations(date DESC);

-- ============================================
-- 画像テーブル（R2のメタデータ管理用）
-- ============================================
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  size INTEGER,
  mime_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_images_post_id ON images(post_id);
