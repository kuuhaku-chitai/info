-- 空白地帯 - カテゴリに「お知らせ」を追加
--
-- SQLiteではCHECK制約を直接変更できないため、
-- テーブルを再作成して制約を更新する。

-- 一時テーブルにデータを退避
CREATE TABLE posts_backup AS SELECT * FROM posts;

-- 既存のテーブルを削除
DROP TABLE posts;

-- CHECK制約を更新した新しいテーブルを作成
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  markdown TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('event', 'article', 'note', 'news')),
  tags TEXT NOT NULL DEFAULT '[]',
  is_published INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  event_start_date TEXT,
  event_end_date TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- データを復元
INSERT INTO posts SELECT * FROM posts_backup;

-- バックアップテーブルを削除
DROP TABLE posts_backup;

-- インデックスを再作成
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_is_published ON posts(is_published);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
