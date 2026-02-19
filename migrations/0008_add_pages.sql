-- 固定ページテーブル
-- 投稿やプロジェクトとは異なるスキーマを持つ固定ページ（concept, aboutなど）
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  markdown TEXT NOT NULL DEFAULT '',
  is_published INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  author_id TEXT REFERENCES admin_users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pages_path ON pages(path);
CREATE INDEX idx_pages_is_published ON pages(is_published);
CREATE INDEX idx_pages_sort_order ON pages(sort_order);
