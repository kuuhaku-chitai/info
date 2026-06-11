-- 物理的バージョン管理（空間のGit）テーブル群
--
-- 物理空間（アトリエ）の「変更そのもの」を、Gitのコミット/ブランチ/マージの
-- 概念で記録・可視化する。変更同士が分岐・合流する有向非巡回グラフ(DAG)を構築する。
--   space_branches        … 履歴を束ねるブランチ（Gitのbranch）
--   version_records       … 変更履歴の本体（Gitのcommit）
--   version_relations     … 変更同士の親子エッジ（複数親 = マージ/合流）
--   version_record_images … 1変更に紐づく複数画像（変更前・中・後など）

-- ============================================
-- ブランチ（履歴を束ねる単位）
-- ============================================
CREATE TABLE space_branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                  -- 例: "2026春レイアウト", "ギャラリー化計画"
  description TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- バージョン（変更履歴の本体 / Gitのコミットに相当）
-- ============================================
CREATE TABLE version_records (
  id TEXT PRIMARY KEY,
  branch_id TEXT NOT NULL REFERENCES space_branches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,                  -- 変更のタイトル
  content TEXT NOT NULL DEFAULT '',     -- 変更内容（Markdown想定）
  reason TEXT,                          -- 変更理由
  memory TEXT,                          -- その場所で起きた、定量化しにくい出来事・記憶（ナラティブ）
  location_note TEXT,                   -- 空間内の具体的な位置に関するメモ
  author TEXT,                          -- 変更者（自由記述。外部協力者も想定）
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_version_records_branch_id ON version_records(branch_id);
CREATE INDEX idx_version_records_created_at ON version_records(created_at);

-- ============================================
-- バージョン間の親子関係（エッジ）
--   1つの child に複数の parent が存在 = マージ（合流）
--   DAG（非巡回）はアプリ層で保証する。SQLでは自己ループのみ禁止。
-- ============================================
CREATE TABLE version_relations (
  parent_version_id TEXT NOT NULL REFERENCES version_records(id) ON DELETE CASCADE,
  child_version_id TEXT NOT NULL REFERENCES version_records(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (parent_version_id, child_version_id),
  CHECK (parent_version_id <> child_version_id)
);

-- 子→親・親→子 双方向のグラフ探索を高速化
CREATE INDEX idx_version_relations_child ON version_relations(child_version_id);
CREATE INDEX idx_version_relations_parent ON version_relations(parent_version_id);

-- ============================================
-- バージョンに紐づく画像（R2のメタデータ）
-- ============================================
CREATE TABLE version_record_images (
  id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL REFERENCES version_records(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,              -- R2にアップロードされた画像のURL
  sort_order INTEGER NOT NULL DEFAULT 0,-- 表示順（変更前→中→後 などの制御）
  caption TEXT,                         -- 画像へのメモ
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_version_record_images_version_id ON version_record_images(version_id);
CREATE INDEX idx_version_record_images_sort_order ON version_record_images(version_id, sort_order);
