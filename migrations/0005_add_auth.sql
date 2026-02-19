-- 空白地帯 - 認証テーブル
--
-- 複数管理者運用のためのユーザー・セッション管理。
-- 投稿・プロジェクトに著者を紐づける。

-- ============================================
-- 管理者ユーザーテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- ============================================
-- セッションテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_id ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- ============================================
-- 投稿・プロジェクトに著者を紐づけ
-- ============================================
ALTER TABLE posts ADD COLUMN author_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN author_id TEXT REFERENCES admin_users(id) ON DELETE SET NULL;
