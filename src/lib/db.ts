/**
 * 空白地帯 - データベースクライアント
 *
 * D1（本番）とSQLite（ローカル）の両方に対応する抽象化レイヤー。
 * ローカル開発時はwrangler経由でD1をエミュレートする。
 *
 * Next.js 16ではCloudflare Workersとの完全な統合が難しいため、
 * 開発時はbetter-sqlite3を使用し、本番はD1 REST APIを使用する。
 */

import { type Post, type Project, type CountdownState, type Donation, type SocialLink, type AdminUser, type ContactInquiry, type InquiryType } from '@/types';

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

  // マイグレーション管理テーブル（scripts/migrate.js のスキーマに合わせる）
  localDb.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 全マイグレーションを順番に実行（未実行のもののみ）
  const migrationsDir = path.join(process.cwd(), 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter((f: string) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const applied = localDb.prepare('SELECT name FROM _migrations WHERE name = ?').get(file);
      if (applied) continue;

      const migration = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      localDb.exec(migration);

      localDb.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        file,
        new Date().toISOString()
      );
    }
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
    monthly_cost: number;
    initial_fund: number;
    updated_at: string;
  }>('SELECT * FROM countdown WHERE id = 1');

  if (!row) {
    throw new Error('Countdown not initialized');
  }

  return {
    startDate: row.start_date,
    initialTotalSeconds: row.initial_total_seconds,
    addedSeconds: row.added_seconds,
    monthlyCost: row.monthly_cost,
    initialFund: row.initial_fund,
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
    projectId: row.project_id as string | undefined,
    authorId: row.author_id as string | undefined,
  };
}

export async function getAllPosts(): Promise<Post[]> {
  const rows = await query('SELECT * FROM posts ORDER BY date DESC');
  return rows.map(rowToPost);
}

export async function getPublishedPosts(): Promise<Post[]> {
  // プロジェクトに紐づく投稿はブログ一覧から除外
  const rows = await query(
    'SELECT * FROM posts WHERE is_published = 1 AND project_id IS NULL ORDER BY date DESC'
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
    `INSERT INTO posts (id, title, date, markdown, category, tags, is_published, thumbnail_url, event_start_date, event_end_date, updated_at, project_id, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      post.projectId || null,
      post.authorId || null,
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
  if (update.projectId !== undefined) {
    fields.push('project_id = ?');
    values.push(update.projectId || null);
  }
  if (update.authorId !== undefined) {
    fields.push('author_id = ?');
    values.push(update.authorId || null);
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

// ============================================
// プロジェクト操作
// ============================================

function rowToProject(row: DbRow): Project {
  return {
    id: row.id as string,
    title: row.title as string,
    date: row.date as string,
    markdown: row.markdown as string,
    category: row.category as Project['category'],
    tags: JSON.parse((row.tags as string) || '[]'),
    isPublished: !!(row.is_published as number),
    thumbnailUrl: row.thumbnail_url as string | undefined,
    eventStartDate: row.event_start_date as string | undefined,
    eventEndDate: row.event_end_date as string | undefined,
    updatedAt: row.updated_at as string,
    authorId: row.author_id as string | undefined,
  };
}

export async function getAllProjects(): Promise<Project[]> {
  const rows = await query('SELECT * FROM projects ORDER BY date DESC');
  return rows.map(rowToProject);
}

export async function getPublishedProjects(): Promise<Project[]> {
  const rows = await query(
    'SELECT * FROM projects WHERE is_published = 1 ORDER BY date DESC'
  );
  return rows.map(rowToProject);
}

export async function getProjectById(id: string): Promise<Project | null> {
  const row = await queryOne('SELECT * FROM projects WHERE id = ?', [id]);
  return row ? rowToProject(row) : null;
}

export async function createProject(project: Omit<Project, 'updatedAt'> & { updatedAt?: string }): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO projects (id, title, date, markdown, category, tags, is_published, thumbnail_url, event_start_date, event_end_date, updated_at, author_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.title,
      project.date,
      project.markdown,
      project.category,
      JSON.stringify(project.tags),
      project.isPublished ? 1 : 0,
      project.thumbnailUrl || null,
      project.eventStartDate || null,
      project.eventEndDate || null,
      project.updatedAt || now,
      project.authorId || null,
    ]
  );
}

export async function updateProject(
  id: string,
  update: Partial<Project>
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
  if (update.authorId !== undefined) {
    fields.push('author_id = ?');
    values.push(update.authorId || null);
  }

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await execute(
    `UPDATE projects SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

export async function deleteProject(id: string): Promise<void> {
  // プロジェクト削除時、紐づく投稿の project_id は ON DELETE SET NULL で自動的に null になる
  await execute('DELETE FROM projects WHERE id = ?', [id]);
}

/** プロジェクトに紐づく公開投稿を取得 */
export async function getPostsByProjectId(projectId: string): Promise<Post[]> {
  const rows = await query(
    'SELECT * FROM posts WHERE project_id = ? AND is_published = 1 ORDER BY date DESC',
    [projectId]
  );
  return rows.map(rowToPost);
}

// ============================================
// 管理者ユーザー操作
// ============================================

function rowToAdminUser(row: DbRow): AdminUser {
  return {
    id: row.id as string,
    username: row.username as string,
    displayName: row.display_name as string,
    avatarUrl: (row.avatar_url as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** ユーザー名でユーザーを検索（パスワードハッシュ含む） */
export async function getUserByUsername(
  username: string
): Promise<(AdminUser & { passwordHash: string }) | null> {
  const row = await queryOne(
    'SELECT * FROM admin_users WHERE username = ?',
    [username]
  );
  if (!row) return null;
  return {
    ...rowToAdminUser(row),
    passwordHash: row.password_hash as string,
  };
}

/** IDでユーザーを取得 */
export async function getUserById(id: string): Promise<AdminUser | null> {
  const row = await queryOne(
    'SELECT id, username, display_name, avatar_url, created_at, updated_at FROM admin_users WHERE id = ?',
    [id]
  );
  return row ? rowToAdminUser(row) : null;
}

/** ユーザーを作成 */
export async function createUser(user: {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO admin_users (id, username, display_name, password_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [user.id, user.username, user.displayName, user.passwordHash, now, now]
  );
}

// ============================================
// セッション操作
// ============================================

/** セッションを作成 */
export async function createDbSession(session: {
  id: string;
  userId: string;
  expiresAt: string;
}): Promise<void> {
  await execute(
    `INSERT INTO admin_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
    [session.id, session.userId, session.expiresAt]
  );
}

/** セッションIDでユーザーを取得（有効期限チェック付き） */
export async function getSessionWithUser(
  sessionId: string
): Promise<AdminUser | null> {
  const row = await queryOne(
    `SELECT u.id, u.username, u.display_name, u.avatar_url, u.created_at, u.updated_at
     FROM admin_sessions s
     JOIN admin_users u ON s.user_id = u.id
     WHERE s.id = ? AND s.expires_at > datetime('now')`,
    [sessionId]
  );
  return row ? rowToAdminUser(row) : null;
}

/** セッションを削除（ログアウト） */
export async function deleteDbSession(sessionId: string): Promise<void> {
  await execute('DELETE FROM admin_sessions WHERE id = ?', [sessionId]);
}

/** 期限切れセッションを削除（lazy cleanup） */
export async function deleteExpiredSessions(): Promise<void> {
  await execute("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')");
}

/** 全ユーザー一覧を取得 */
export async function getAllUsers(): Promise<AdminUser[]> {
  const rows = await query(
    'SELECT id, username, display_name, avatar_url, created_at, updated_at FROM admin_users ORDER BY created_at ASC'
  );
  return rows.map(rowToAdminUser);
}

/** ユーザー情報を更新 */
export async function updateUser(
  id: string,
  update: { displayName?: string; avatarUrl?: string | null; passwordHash?: string }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (update.displayName !== undefined) {
    fields.push('display_name = ?');
    values.push(update.displayName);
  }
  if (update.avatarUrl !== undefined) {
    fields.push('avatar_url = ?');
    values.push(update.avatarUrl);
  }
  if (update.passwordHash !== undefined) {
    fields.push('password_hash = ?');
    values.push(update.passwordHash);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await execute(
    `UPDATE admin_users SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

// ============================================
// 問い合わせ操作
// ============================================

function rowToInquiry(row: DbRow): ContactInquiry {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: (row.phone as string) || undefined,
    organization: (row.organization as string) || undefined,
    inquiryType: row.inquiry_type as InquiryType,
    message: row.message as string,
    isRead: !!(row.is_read as number),
    isReplied: !!(row.is_replied as number),
    adminNote: (row.admin_note as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

/** 問い合わせを作成 */
export async function createInquiry(data: {
  id: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  inquiryType: InquiryType;
  message: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await execute(
    `INSERT INTO contact_inquiries (id, name, email, phone, organization, inquiry_type, message, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.id,
      data.name,
      data.email,
      data.phone || null,
      data.organization || null,
      data.inquiryType,
      data.message,
      now,
      now,
    ]
  );
}

/** 問い合わせ一覧を取得 */
export async function getInquiries(options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ContactInquiry[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.unreadOnly) {
    conditions.push('is_read = 0');
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = options?.limit ? `LIMIT ${options.limit}` : '';
  const offset = options?.offset ? `OFFSET ${options.offset}` : '';

  const rows = await query(
    `SELECT * FROM contact_inquiries ${where} ORDER BY created_at DESC ${limit} ${offset}`,
    params
  );
  return rows.map(rowToInquiry);
}

/** 問い合わせをIDで取得 */
export async function getInquiryById(id: string): Promise<ContactInquiry | null> {
  const row = await queryOne('SELECT * FROM contact_inquiries WHERE id = ?', [id]);
  return row ? rowToInquiry(row) : null;
}

/** 問い合わせを更新（既読/返信済み/管理者メモ） */
export async function updateInquiry(
  id: string,
  update: { isRead?: boolean; isReplied?: boolean; adminNote?: string }
): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (update.isRead !== undefined) {
    fields.push('is_read = ?');
    values.push(update.isRead ? 1 : 0);
  }
  if (update.isReplied !== undefined) {
    fields.push('is_replied = ?');
    values.push(update.isReplied ? 1 : 0);
  }
  if (update.adminNote !== undefined) {
    fields.push('admin_note = ?');
    values.push(update.adminNote);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());
  values.push(id);

  await execute(
    `UPDATE contact_inquiries SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
}

/** 未読問い合わせ件数を取得 */
export async function getUnreadInquiryCount(): Promise<number> {
  const result = await queryOne<{ count: number }>(
    'SELECT COUNT(*) as count FROM contact_inquiries WHERE is_read = 0'
  );
  return result?.count || 0;
}

/** カウントダウン設定を更新（開始日、初期総秒数、月額コスト、初期資金） */
export async function updateCountdownSettings(data: {
  startDate?: string;
  initialTotalSeconds?: number;
  monthlyCost?: number;
  initialFund?: number;
}): Promise<void> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.startDate !== undefined) {
    fields.push('start_date = ?');
    values.push(data.startDate);
  }
  if (data.initialTotalSeconds !== undefined) {
    fields.push('initial_total_seconds = ?');
    values.push(data.initialTotalSeconds);
  }
  if (data.monthlyCost !== undefined) {
    fields.push('monthly_cost = ?');
    values.push(data.monthlyCost);
  }
  if (data.initialFund !== undefined) {
    fields.push('initial_fund = ?');
    values.push(data.initialFund);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  await execute(
    `UPDATE countdown SET ${fields.join(', ')} WHERE id = 1`,
    values
  );
}
