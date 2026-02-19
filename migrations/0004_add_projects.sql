-- 空白地帯 - プロジェクト機能追加
--
-- projects テーブル: 投稿と同じ構造を持つプロジェクトを管理
-- posts.project_id: 投稿をプロジェクトに紐づける外部キー

-- プロジェクトテーブル（posts と同構造）
CREATE TABLE IF NOT EXISTS projects (
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

CREATE INDEX IF NOT EXISTS idx_projects_is_published ON projects(is_published);
CREATE INDEX IF NOT EXISTS idx_projects_date ON projects(date DESC);

-- 投稿にプロジェクト紐づけカラムを追加
ALTER TABLE posts ADD COLUMN project_id TEXT REFERENCES projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_posts_project_id ON posts(project_id);
