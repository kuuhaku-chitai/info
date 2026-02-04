/**
 * 空白地帯 - データベースクライアント
 *
 * D1（本番）とSQLite（ローカル）の両方に対応する抽象化レイヤー。
 * ローカル開発時はwrangler経由でD1をエミュレートする。
 *
 * Next.js 16ではCloudflare Workersとの完全な統合が難しいため、
 * 開発時はbetter-sqlite3を使用し、本番はD1 REST APIを使用する。
 */

import { type Post, type CountdownState, type Donation, type SocialLink } from '@/types';

// ============================================
// 型定義
// ============================================

interface DbRow {
  [key: string]: unknown;
}

// ============================================
// 環境判定
// ============================================

const isProduction = process.env.NODE_ENV === 'production';
const useD1Api = !!process.env.CLOUDFLARE_D1_API_TOKEN;

// ============================================
// D1 REST API クライアント（本番用）
// ============================================

async function executeD1Query<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN;

  if (!accountId || !databaseId || !apiToken) {
    throw new Error('D1 API credentials not configured');
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.errors?.[0]?.message || 'D1 query failed');
  }

  return result.result?.[0]?.results || [];
}

// ============================================
// ローカルSQLite（開発用）
// ============================================

let localDb: import('better-sqlite3').Database | null = null;

async function getLocalDb(): Promise<import('better-sqlite3').Database> {
  if (localDb) return localDb;

  // 動的インポート（サーバーサイドのみ）
  const Database = (await import('better-sqlite3')).default;
  const path = await import('path');
  const fs = await import('fs');

  const dbDir = path.join(process.cwd(), '.wrangler', 'state', 'v3', 'd1');
  const dbPath = path.join(dbDir, 'kuuhaku-chitai.sqlite');

  // ディレクトリ作成
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  localDb = new Database(dbPath);

  // マイグレーション実行
  const migrationPath = path.join(process.cwd(), 'migrations', '0001_initial.sql');
  if (fs.existsSync(migrationPath)) {
    const migration = fs.readFileSync(migrationPath, 'utf-8');
    localDb.exec(migration);
  }

  return localDb;
}

async function executeLocalQuery<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const db = await getLocalDb();

  // SELECT判定
  const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

  if (isSelect) {
    const stmt = db.prepare(sql);
    return stmt.all(...params) as T[];
  } else {
    const stmt = db.prepare(sql);
    stmt.run(...params);
    return [];
  }
}

// ============================================
// 統合クエリ関数
// ============================================

export async function query<T = DbRow>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (useD1Api) {
    return executeD1Query<T>(sql, params);
  } else {
    return executeLocalQuery<T>(sql, params);
  }
}

export async function queryOne<T = DbRow>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results[0] || null;
}

export async function execute(
  sql: string,
  params: unknown[] = []
): Promise<void> {
  await query(sql, params);
}

// ============================================
// カウントダウン操作
// ============================================

export async function getCountdown(): Promise<CountdownState> {
  const row = await queryOne<{
    start_date: string;
    initial_total_seconds: number;
    added_seconds: number;
    updated_at: string;
  }>('SELECT * FROM countdown WHERE id = 1');

  if (!row) {
    throw new Error('Countdown not initialized');
  }

  return {
    startDate: row.start_date,
    initialTotalSeconds: row.initial_total_seconds,
    addedSeconds: row.added_seconds,
    updatedAt: row.updated_at,
  };
}

export async function updateCountdownAddedSeconds(
  addedSeconds: number
): Promise<void> {
  await execute(
    'UPDATE countdown SET added_seconds = ?, updated_at = ? WHERE id = 1',
    [addedSeconds, new Date().toISOString()]
  );
}

// ============================================
// 投稿操作
// ============================================

function rowToPost(row: DbRow): Post {
  return {
    id: row.id as string,
    title: row.title as string,
    date: row.date as string,
    markdown: row.markdown as string,
    category: row.category as Post['category'],
    tags: JSON.parse((row.tags as string) || '[]'),
    isPublished: !!(row.is_published as number),
    thumbnailUrl: row.thumbnail_url as string | undefined,
    eventStartDate: row.event_start_date as string | undefined,
    eventEndDate: row.event_end_date as string | undefined,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllPosts(): Promise<Post[]> {
  const rows = await query('SELECT * FROM posts ORDER BY date DESC');
  return rows.map(rowToPost);
}

export async function getPublishedPosts(): Promise<Post[]> {
  const rows = await query(
    'SELECT * FROM posts WHERE is_published = 1 ORDER BY date DESC'
  );
  return rows.map(rowToPost);
}

export async function getPostsByCategory(category: string): Promise<Post[]> {
  const rows = await query(
    'SELECT * FROM posts WHERE category = ? AND is_published = 1 ORDER BY date DESC',
    [category]
  );
  return rows.map(rowToPost);
}

export async function getPostById(id: string): Promise<Post | null> {
  const row = await queryOne('SELECT * FROM posts WHERE id = ?', [id]);
  return row ? rowToPost(row) : null;
}

export async function createPost(post: Omit<Post, 'updatedAt'> & { updatedAt?: string }): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO posts (id, title, date, markdown, category, tags, is_published, thumbnail_url, event_start_date, event_end_date, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      post.id,
      post.title,
      post.date,
      post.markdown,
      post.category,
      JSON.stringify(post.tags),
      post.isPublished ? 1 : 0,
      post.thumbnailUrl || null,
      post.eventStartDate || null,
      post.eventEndDate || null,
      post.updatedAt || now,
    ]
  );
}

export async function updatePost(
  id: string,
  update: Partial<Post>
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (update.title !== undefined) {
    fields.push('title = ?');
    values.push(update.title);
  }
  if (update.markdown !== undefined) {
    fields.push('markdown = ?');
    values.push(update.markdown);
  }
  if (update.category !== undefined) {
    fields.push('category = ?');
    values.push(update.category);
  }
  if (update.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(update.tags));
  }
  if (update.isPublished !== undefined) {
    fields.push('is_published = ?');
    values.push(update.isPublished ? 1 : 0);
  }
  if (update.thumbnailUrl !== undefined) {
    fields.push('thumbnail_url = ?');
    values.push(update.thumbnailUrl || null);
  }
  if (update.eventStartDate !== undefined) {
    fields.push('event_start_date = ?');
    values.push(update.eventStartDate || null);
  }
  if (update.eventEndDate !== undefined) {
    fields.push('event_end_date = ?');
    values.push(update.eventEndDate || null);
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await execute(
    `UPDATE posts SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deletePost(id: string): Promise<void> {
  await execute('DELETE FROM posts WHERE id = ?', [id]);
}

// ============================================
// 入金操作
// ============================================

function rowToDonation(row: DbRow): Donation {
  return {
    id: row.id as string,
    amount: row.amount as number,
    addedSeconds: row.added_seconds as number,
    date: row.date as string,
    note: row.note as string | undefined,
  };
}

export async function getAllDonations(): Promise<Donation[]> {
  const rows = await query('SELECT * FROM donations ORDER BY date DESC');
  return rows.map(rowToDonation);
}

export async function createDonation(donation: Donation): Promise<void> {
  await execute(
    `INSERT INTO donations (id, amount, added_seconds, date, note)
     VALUES (?, ?, ?, ?, ?)`,
    [
      donation.id,
      donation.amount,
      donation.addedSeconds,
      donation.date,
      donation.note || null,
    ]
  );

  // カウントダウンの延命を更新
  const countdown = await getCountdown();
  await updateCountdownAddedSeconds(countdown.addedSeconds + donation.addedSeconds);
}

export async function deleteDonation(id: string): Promise<boolean> {
  // 削除前に入金情報を取得
  const row = await queryOne<{ added_seconds: number }>(
    'SELECT added_seconds FROM donations WHERE id = ?',
    [id]
  );

  if (!row) return false;

  // 入金を削除
  await execute('DELETE FROM donations WHERE id = ?', [id]);

  // カウントダウンから延命を差し引く
  const countdown = await getCountdown();
  await updateCountdownAddedSeconds(countdown.addedSeconds - row.added_seconds);

  return true;
}

// ============================================
// 統計
// ============================================

export async function getStats() {
  const [postsResult, donationsResult, countdown] = await Promise.all([
    query<{ total: number; published: number; upcoming: number }>(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END) as published,
        SUM(CASE WHEN category = 'event' AND is_published = 1 AND event_start_date > datetime('now') THEN 1 ELSE 0 END) as upcoming
       FROM posts`
    ),
    query<{ total: number; total_amount: number }>(
      'SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount FROM donations'
    ),
    getCountdown(),
  ]);

  return {
    totalPosts: postsResult[0]?.total || 0,
    publishedPosts: postsResult[0]?.published || 0,
    upcomingEvents: postsResult[0]?.upcoming || 0,
    totalDonations: donationsResult[0]?.total || 0,
    totalDonationAmount: donationsResult[0]?.total_amount || 0,
    addedSeconds: countdown.addedSeconds,
  };
}

// ============================================
// ソーシャルリンク操作
// ============================================

function rowToSocialLink(row: DbRow): SocialLink {
  return {
    id: row.id as string,
    title: row.title as string,
    url: row.url as string,
    iconUrl: row.icon_url as string,
    sortOrder: row.sort_order as number,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function getAllSocialLinks(): Promise<SocialLink[]> {
  const rows = await query('SELECT * FROM social_links ORDER BY sort_order ASC');
  return rows.map(rowToSocialLink);
}

export async function getSocialLinkById(id: string): Promise<SocialLink | null> {
  const row = await queryOne('SELECT * FROM social_links WHERE id = ?', [id]);
  return row ? rowToSocialLink(row) : null;
}

export async function createSocialLink(
  link: Omit<SocialLink, 'createdAt' | 'updatedAt'> & { updatedAt?: string }
): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO social_links (id, title, url, icon_url, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      link.id,
      link.title,
      link.url,
      link.iconUrl,
      link.sortOrder,
      now,
      link.updatedAt || now,
    ]
  );
}

export async function updateSocialLink(
  id: string,
  update: Partial<Omit<SocialLink, 'id' | 'createdAt'>>
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (update.title !== undefined) {
    fields.push('title = ?');
    values.push(update.title);
  }
  if (update.url !== undefined) {
    fields.push('url = ?');
    values.push(update.url);
  }
  if (update.iconUrl !== undefined) {
    fields.push('icon_url = ?');
    values.push(update.iconUrl);
  }
  if (update.sortOrder !== undefined) {
    fields.push('sort_order = ?');
    values.push(update.sortOrder);
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await execute(
    `UPDATE social_links SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteSocialLink(id: string): Promise<void> {
  await execute('DELETE FROM social_links WHERE id = ?', [id]);
}
