-- 空白地帯 - 問い合わせテーブル追加
-- お問い合わせフォームからの送信を保存する

CREATE TABLE contact_inquiries (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  organization TEXT,
  inquiry_type TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  is_replied INTEGER NOT NULL DEFAULT 0,
  admin_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- パフォーマンス用インデックス
CREATE INDEX idx_inquiries_created_at ON contact_inquiries(created_at DESC);
CREATE INDEX idx_inquiries_is_read ON contact_inquiries(is_read);
