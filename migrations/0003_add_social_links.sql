-- 空白地帯 - ソーシャルリンクテーブル追加
--
-- SNS等へのリンクを管理するテーブル。
-- アイコン画像URLとソート順序を持つ。

-- ============================================
-- ソーシャルリンクテーブル
-- ============================================
CREATE TABLE IF NOT EXISTS social_links (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL
);

-- ソート順序でのインデックス
CREATE INDEX IF NOT EXISTS idx_social_links_sort_order ON social_links(sort_order ASC);
