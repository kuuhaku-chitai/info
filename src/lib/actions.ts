'use server';

/**
 * 空白地帯 - Server Actions
 *
 * すべてのデータ操作はServer Actionsを通じて行う。
 * D1（本番）とSQLite（ローカル）に対応。
 */

import { revalidatePath } from 'next/cache';
import { type Post, type Project, type Donation, type CountdownState, type SocialLink, type AdminUser, type ContactInquiry, type InquiryType, type Page, type SpaceBranch, type VersionRecord, type VersionRecordDetail, type VersionGraphData } from '@/types';
import { SECONDS_PER_MONTH } from './constants';
import * as db from './db';
import { notifyLifespanExtension, notifyNewEvent, notifyNewInquiry, notifyNewVersion } from './discord';
import { calculateRemainingSeconds } from './countdown';
import { getSession } from './auth';

// ============================================
// ID生成ユーティリティ
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// カウントダウン Actions
// ============================================

export async function fetchCountdownState(): Promise<CountdownState> {
  return db.getCountdown();
}

// ============================================
// 投稿 Actions
// ============================================

export async function fetchAllPosts(): Promise<Post[]> {
  return db.getAllPosts();
}

export async function fetchPublishedPosts(): Promise<Post[]> {
  return db.getPublishedPosts();
}

export async function fetchPostsByCategory(
  category: Post['category']
): Promise<Post[]> {
  return db.getPostsByCategory(category);
}

export async function fetchPostById(id: string): Promise<Post | null> {
  return db.getPostById(id);
}

export async function createNewPost(
  data: Omit<Post, 'id' | 'updatedAt' | 'authorId'>
): Promise<Post> {
  // セッションから著者IDを自動取得
  const user = await getSession();
  const now = new Date().toISOString();
  const post: Post = {
    ...data,
    id: generateId(),
    updatedAt: now,
    authorId: user?.id,
  };

  await db.createPost(post);

  // イベント投稿が公開された場合、Discord通知
  if (post.isPublished && post.category === 'event') {
    await notifyNewEvent(post.title, post.eventStartDate ?? post.date);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/posts');
  revalidatePath('/blog');
  revalidatePath('/schedule');
  revalidatePath('/projects');
  revalidatePath('/');

  return post;
}

export async function updateExistingPost(
  id: string,
  data: Partial<Post>
): Promise<Post | null> {
  const existing = await db.getPostById(id);
  if (!existing) return null;

  await db.updatePost(id, data);

  const updated = await db.getPostById(id);

  // 非公開→公開になった場合、Discord通知
  if (
    !existing.isPublished &&
    updated?.isPublished &&
    updated.category === 'event'
  ) {
    await notifyNewEvent(updated.title, updated.eventStartDate ?? updated.date);
  }

  revalidatePath('/admin');
  revalidatePath('/admin/posts');
  revalidatePath(`/admin/posts/${id}`);
  revalidatePath('/blog');
  revalidatePath('/schedule');
  revalidatePath('/projects');
  revalidatePath('/');

  return updated;
}

export async function deleteExistingPost(id: string): Promise<boolean> {
  await db.deletePost(id);

  revalidatePath('/admin');
  revalidatePath('/admin/posts');
  revalidatePath('/blog');
  revalidatePath('/schedule');
  revalidatePath('/projects');
  revalidatePath('/');

  return true;
}

// ============================================
// 入金 Actions
// ============================================

export async function fetchAllDonations(): Promise<Donation[]> {
  return db.getAllDonations();
}

export async function recordNewDonation(
  data: Omit<Donation, 'id' | 'addedSeconds'>
): Promise<Donation> {
  // DBの月額コストを使って秒数を計算（定数のamountToSecondsはフォールバック）
  const countdown = await db.getCountdown();
  const dynamicMonthlyCost = countdown.monthlyCost;
  const addedSeconds = Math.floor((data.amount / dynamicMonthlyCost) * SECONDS_PER_MONTH);
  const addedDays = Math.floor(addedSeconds / (24 * 60 * 60));

  const donation: Donation = {
    ...data,
    id: generateId(),
    addedSeconds,
  };

  await db.createDonation(donation);

  // 延命通知をDiscordに送信
  const remainingSeconds = calculateRemainingSeconds(countdown);
  const remainingDays = Math.floor(remainingSeconds / (24 * 60 * 60));

  await notifyLifespanExtension(addedDays, remainingDays);

  revalidatePath('/admin');
  revalidatePath('/admin/donations');
  revalidatePath('/');

  return donation;
}

export async function deleteExistingDonation(id: string): Promise<boolean> {
  const result = await db.deleteDonation(id);

  if (result) {
    revalidatePath('/admin');
    revalidatePath('/admin/donations');
    revalidatePath('/');
  }

  return result;
}

// ============================================
// 統計 Actions
// ============================================

export async function fetchStats() {
  return db.getStats();
}

// ============================================
// ソーシャルリンク Actions
// ============================================

export async function fetchAllSocialLinks(): Promise<SocialLink[]> {
  return db.getAllSocialLinks();
}

export async function fetchSocialLinkById(id: string): Promise<SocialLink | null> {
  return db.getSocialLinkById(id);
}

export async function createNewSocialLink(
  data: Omit<SocialLink, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SocialLink> {
  const now = new Date().toISOString();
  const link: Omit<SocialLink, 'createdAt'> & { createdAt?: string } = {
    ...data,
    id: generateId(),
    updatedAt: now,
  };

  await db.createSocialLink(link);

  revalidatePath('/admin/social');
  revalidatePath('/');

  return {
    ...link,
    createdAt: now,
  } as SocialLink;
}

export async function updateExistingSocialLink(
  id: string,
  data: Partial<Omit<SocialLink, 'id' | 'createdAt'>>
): Promise<SocialLink | null> {
  const existing = await db.getSocialLinkById(id);
  if (!existing) return null;

  await db.updateSocialLink(id, data);

  const updated = await db.getSocialLinkById(id);

  revalidatePath('/admin/social');
  revalidatePath(`/admin/social/${id}`);
  revalidatePath('/');

  return updated;
}

export async function deleteExistingSocialLink(id: string): Promise<boolean> {
  await db.deleteSocialLink(id);

  revalidatePath('/admin/social');
  revalidatePath('/');

  return true;
}

// ============================================
// プロジェクト Actions
// ============================================

export async function fetchAllProjects(): Promise<Project[]> {
  return db.getAllProjects();
}

export async function fetchPublishedProjects(): Promise<Project[]> {
  return db.getPublishedProjects();
}

export async function fetchProjectById(id: string): Promise<Project | null> {
  return db.getProjectById(id);
}

/** プロジェクトに紐づく公開投稿を取得 */
export async function fetchPostsByProjectId(projectId: string): Promise<Post[]> {
  return db.getPostsByProjectId(projectId);
}

export async function createNewProject(
  data: Omit<Project, 'id' | 'updatedAt' | 'authorId'>
): Promise<Project> {
  // セッションから著者IDを自動取得
  const user = await getSession();
  const now = new Date().toISOString();
  const project: Project = {
    ...data,
    id: generateId(),
    updatedAt: now,
    authorId: user?.id,
  };

  await db.createProject(project);

  revalidatePath('/admin');
  revalidatePath('/admin/projects');
  revalidatePath('/projects');
  revalidatePath('/');

  return project;
}

export async function updateExistingProject(
  id: string,
  data: Partial<Project>
): Promise<Project | null> {
  const existing = await db.getProjectById(id);
  if (!existing) return null;

  await db.updateProject(id, data);

  const updated = await db.getProjectById(id);

  revalidatePath('/admin');
  revalidatePath('/admin/projects');
  revalidatePath(`/admin/projects/${id}`);
  revalidatePath('/projects');
  revalidatePath(`/project/${id}`);
  revalidatePath('/');

  return updated;
}

export async function deleteExistingProject(id: string): Promise<boolean> {
  await db.deleteProject(id);

  revalidatePath('/admin');
  revalidatePath('/admin/projects');
  revalidatePath('/projects');
  revalidatePath('/blog');
  revalidatePath('/');

  return true;
}

// ============================================
// ユーザー管理 Actions
// ============================================

export async function fetchAllUsers(): Promise<AdminUser[]> {
  return db.getAllUsers();
}

export async function fetchUserById(id: string): Promise<AdminUser | null> {
  return db.getUserById(id);
}

export async function updateExistingUser(
  id: string,
  data: { displayName?: string; avatarUrl?: string | null; newPassword?: string }
): Promise<AdminUser | null> {
  const existing = await db.getUserById(id);
  if (!existing) return null;

  const updateData: { displayName?: string; avatarUrl?: string | null; passwordHash?: string } = {};

  if (data.displayName !== undefined) {
    updateData.displayName = data.displayName;
  }
  if (data.avatarUrl !== undefined) {
    updateData.avatarUrl = data.avatarUrl;
  }
  if (data.newPassword) {
    // パスワード変更時はハッシュ化
    const { hashPassword } = await import('./auth');
    updateData.passwordHash = await hashPassword(data.newPassword);
  }

  await db.updateUser(id, updateData);

  revalidatePath('/admin');
  revalidatePath('/admin/users');

  return db.getUserById(id);
}

// ============================================
// カウントダウン設定 Actions
// ============================================

export async function updateCountdownSettingsAction(data: {
  startDate?: string;
  monthlyCost?: number;
  initialFund?: number;
}): Promise<CountdownState> {
  const updateData: Parameters<typeof db.updateCountdownSettings>[0] = {};

  if (data.startDate !== undefined) {
    updateData.startDate = data.startDate;
  }
  if (data.monthlyCost !== undefined) {
    updateData.monthlyCost = data.monthlyCost;
  }
  if (data.initialFund !== undefined) {
    updateData.initialFund = data.initialFund;
  }

  // monthlyCost/initialFund が変わった場合、initialTotalSeconds を再計算
  if (data.monthlyCost !== undefined || data.initialFund !== undefined) {
    const current = await db.getCountdown();
    const monthlyCost = data.monthlyCost ?? current.monthlyCost;
    const initialFund = data.initialFund ?? current.initialFund;
    updateData.initialTotalSeconds = Math.floor((initialFund / monthlyCost) * SECONDS_PER_MONTH);
  }

  await db.updateCountdownSettings(updateData);

  revalidatePath('/admin');
  revalidatePath('/');

  return db.getCountdown();
}

// ============================================
// 問い合わせ Actions
// ============================================

/** 問い合わせを送信（公開フォーム用） */
export async function submitContactInquiry(data: {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  inquiryType: InquiryType;
  message: string;
}): Promise<ContactInquiry> {
  const id = generateId();
  await db.createInquiry({ id, ...data });

  const inquiry = await db.getInquiryById(id);
  if (!inquiry) throw new Error('Failed to create inquiry');

  // 2. メールおよびDiscord通知を並行して実行し、すべて完了するまで待機する
  // (Cloudflare Workers 等の環境で、応答を返す前に処理が中断されるのを防ぐ)
  const { sendAutoReply, sendAdminNotification } = await import('./email');

  await Promise.allSettled([
    sendAutoReply(data.email, data.name, data.inquiryType, data.message),
    sendAdminNotification(inquiry),
    notifyNewInquiry(data.name, data.inquiryType)
  ]).then((results) => {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const labels = ['Auto-reply', 'Admin notification', 'Discord notification'];
        console.error(`[Inquiry] ${labels[index]} failed:`, result.reason);
      }
    });
  });

  return inquiry;
}

/** 問い合わせ一覧を取得（管理画面用） */
export async function fetchInquiries(options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<ContactInquiry[]> {
  return db.getInquiries(options);
}

/** 問い合わせをIDで取得（管理画面用） */
export async function fetchInquiryById(id: string): Promise<ContactInquiry | null> {
  return db.getInquiryById(id);
}

/** 問い合わせを既読にする */
export async function markInquiryAsRead(id: string): Promise<void> {
  await db.updateInquiry(id, { isRead: true });
  revalidatePath('/admin/inquiries');
}

/** 問い合わせを返信済みにする */
export async function markInquiryAsReplied(id: string): Promise<void> {
  await db.updateInquiry(id, { isReplied: true });
  revalidatePath('/admin/inquiries');
  revalidatePath(`/admin/inquiries/${id}`);
}

/** 管理者メモを更新 */
export async function updateInquiryNote(id: string, note: string): Promise<void> {
  await db.updateInquiry(id, { adminNote: note });
  revalidatePath(`/admin/inquiries/${id}`);
}

/** 未読問い合わせ件数を取得 */
export async function fetchUnreadInquiryCount(): Promise<number> {
  return db.getUnreadInquiryCount();
}

// ============================================
// 固定ページ Actions
// ============================================

export async function fetchAllPages(): Promise<Page[]> {
  return db.getAllPages();
}

export async function fetchPublishedPages(): Promise<Page[]> {
  return db.getPublishedPages();
}

export async function fetchPageById(id: string): Promise<Page | null> {
  return db.getPageById(id);
}

export async function fetchPageByPath(path: string): Promise<Page | null> {
  return db.getPageByPath(path);
}

export async function createNewPage(
  data: Omit<Page, 'id' | 'createdAt' | 'updatedAt' | 'authorId'>
): Promise<Page> {
  const user = await getSession();
  const now = new Date().toISOString();
  const page = {
    ...data,
    id: generateId(),
    authorId: user?.id,
    createdAt: now,
    updatedAt: now,
  };

  await db.createPage(page);

  revalidatePath('/admin');
  revalidatePath('/admin/pages');
  revalidatePath('/');
  revalidatePath(`/${data.path}`);

  return page;
}

export async function updateExistingPage(
  id: string,
  data: Partial<Page>
): Promise<Page | null> {
  const existing = await db.getPageById(id);
  if (!existing) return null;

  await db.updatePage(id, data);

  const updated = await db.getPageById(id);

  revalidatePath('/admin');
  revalidatePath('/admin/pages');
  revalidatePath(`/admin/pages/${id}`);
  revalidatePath('/');
  // 旧パスと新パスの両方をrevalidate
  revalidatePath(`/${existing.path}`);
  if (data.path && data.path !== existing.path) {
    revalidatePath(`/${data.path}`);
  }

  return updated;
}

export async function deleteExistingPage(id: string): Promise<boolean> {
  const existing = await db.getPageById(id);
  await db.deletePage(id);

  revalidatePath('/admin');
  revalidatePath('/admin/pages');
  revalidatePath('/');
  if (existing) {
    revalidatePath(`/${existing.path}`);
  }

  return true;
}

// ============================================
// 物理的バージョン管理 Actions（空間のGit / DAG）
// ============================================
//
// 画像はクライアントが /api/images（R2/MinIOアップロード）へ先にアップロードし、
// 確定した画像URL配列を以下のActionへ渡す（既存の投稿フォームと同じ流儀）。
// 画像フォルダはバージョンIDで分割される前提（posts/{versionId}/...）。
// そのためフォームはバージョンIDをクライアント側で先に生成し、id として渡すこと
// （削除時に deleteAllPostImages(versionId) でR2を確実に掃除できる）。

/** 親IDの重複・自己参照を除いた配列を返す */
function sanitizeParentIds(parentIds: string[] | undefined, selfId: string): string[] {
  return Array.from(new Set(parentIds ?? [])).filter((pid) => pid && pid !== selfId);
}

/** バージョンに渡す画像メタデータ（URLはアップロード済み前提） */
interface VersionImageInput {
  imageUrl: string;
  caption?: string;
  sortOrder?: number;
}

interface CreateVersionInput {
  /** クライアント生成のID（画像フォルダ分割に使用）。省略時はサーバー生成 */
  id?: string;
  branchId: string;
  title: string;
  content?: string;
  reason?: string;
  memory?: string;
  locationNote?: string;
  author?: string;
  /** 親バージョンID（複数 = マージ） */
  parentIds?: string[];
  images?: VersionImageInput[];
}

interface UpdateVersionInput {
  branchId?: string;
  title?: string;
  content?: string;
  reason?: string;
  memory?: string;
  locationNote?: string;
  author?: string;
  /** 指定時は親エッジを総入れ替え（循環検知あり） */
  parentIds?: string[];
  /** 指定時は画像を総入れ替え */
  images?: VersionImageInput[];
}

function revalidateSpacePaths(): void {
  revalidatePath('/admin');
  revalidatePath('/admin/space');
  // 公開グラフ閲覧ビュー（DAG）
  revalidatePath('/history');
  revalidatePath('/');
}

// --- ブランチ ---

export async function fetchAllBranches(): Promise<SpaceBranch[]> {
  return db.getAllBranches();
}

export async function fetchBranchById(id: string): Promise<SpaceBranch | null> {
  return db.getBranchById(id);
}

export async function createNewBranch(data: {
  id?: string;
  name: string;
  description?: string;
}): Promise<SpaceBranch> {
  if (!data.name?.trim()) throw new Error('ブランチ名は必須です');

  const now = new Date().toISOString();
  const id = data.id ?? generateId();
  const branch: SpaceBranch = {
    id,
    name: data.name.trim(),
    description: data.description?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await db.createBranch(branch);
  revalidateSpacePaths();

  return branch;
}

export async function updateExistingBranch(
  id: string,
  data: { name?: string; description?: string }
): Promise<SpaceBranch | null> {
  const existing = await db.getBranchById(id);
  if (!existing) return null;

  await db.updateBranch(id, data);
  revalidateSpacePaths();

  return db.getBranchById(id);
}

export async function deleteExistingBranch(id: string): Promise<boolean> {
  // ブランチ配下の各バージョンのR2画像フォルダを掃除してから削除
  const versions = await db.getVersionsByBranch(id);
  const { deleteAllPostImages } = await import('./storage');
  await Promise.allSettled(versions.map((v) => deleteAllPostImages(v.id)));

  await db.deleteBranch(id); // version/relation/image はCASCADEで連鎖削除
  revalidateSpacePaths();

  return true;
}

// --- バージョン（コミット） ---

export async function fetchVersionsByBranch(branchId: string): Promise<VersionRecord[]> {
  return db.getVersionsByBranch(branchId);
}

/** 画像・親IDを同梱した詳細を取得（詳細パネル・編集フォーム用） */
/**
 * 記憶の粒（Canvasビジュアライザー）用：ランダムな履歴画像の参照。
 * 公開ページで使うため公開情報（URLとversionId）のみを返す。
 */
export async function fetchVersionImageRefs(): Promise<
  Array<{ imageUrl: string; versionId: string }>
> {
  return db.getRandomVersionImageRefs(12);
}

export async function fetchVersionDetail(id: string): Promise<VersionRecordDetail | null> {
  const version = await db.getVersionById(id);
  if (!version) return null;

  const [images, parentIds] = await Promise.all([
    db.getImagesByVersionId(id),
    db.getParentVersionIds(id),
  ]);

  return { ...version, images, parentIds };
}

/** グラフ描画用のDAGデータ一式（React Flow / Step 4） */
export async function fetchVersionGraph(): Promise<VersionGraphData> {
  const [branches, versions, relations] = await Promise.all([
    db.getAllBranches(),
    db.getAllVersions(),
    db.getAllRelations(),
  ]);

  return { branches, versions, relations };
}

export async function createNewVersionRecord(data: CreateVersionInput): Promise<VersionRecord> {
  const branch = await db.getBranchById(data.branchId);
  if (!branch) throw new Error('指定されたブランチが存在しません');
  if (!data.title?.trim()) throw new Error('タイトルは必須です');

  const now = new Date().toISOString();
  const id = data.id ?? generateId();

  const version: VersionRecord = {
    id,
    branchId: data.branchId,
    title: data.title.trim(),
    content: data.content ?? '',
    reason: data.reason?.trim() || undefined,
    memory: data.memory?.trim() || undefined,
    locationNote: data.locationNote?.trim() || undefined,
    author: data.author?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await db.createVersion(version);

  // 親エッジを追加。
  // 新規バージョンは出力辺（子）を持たないため、親をいくつ追加しても循環は発生しない。
  const parentIds = sanitizeParentIds(data.parentIds, id);
  for (const parentId of parentIds) {
    const parent = await db.getVersionById(parentId);
    if (parent) {
      await db.addRelation(parentId, id);
    }
  }

  // 画像メタデータ（URLはアップロード済み）
  const images = data.images ?? [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    await db.createVersionImage({
      id: generateId(),
      versionId: id,
      imageUrl: img.imageUrl,
      sortOrder: img.sortOrder ?? i,
      caption: img.caption?.trim() || undefined,
    });
  }

  // Discord通知（新規イベント / 複数親ならマージとして通知）
  await notifyNewVersion(branch.name, version.title, parentIds.length > 1);

  revalidateSpacePaths();

  return version;
}

export async function updateExistingVersionRecord(
  id: string,
  data: UpdateVersionInput
): Promise<VersionRecordDetail | null> {
  const existing = await db.getVersionById(id);
  if (!existing) return null;

  // ブランチ変更時は実在チェック
  if (data.branchId !== undefined && data.branchId !== existing.branchId) {
    const branch = await db.getBranchById(data.branchId);
    if (!branch) throw new Error('指定されたブランチが存在しません');
  }

  await db.updateVersion(id, {
    branchId: data.branchId,
    title: data.title?.trim(),
    content: data.content,
    reason: data.reason,
    memory: data.memory,
    locationNote: data.locationNote,
    author: data.author,
  });

  // 親エッジの付け替え（循環検知）
  if (data.parentIds !== undefined) {
    const parentIds = sanitizeParentIds(data.parentIds, id);

    // このバージョンから到達可能な子孫を親にすると循環する → 拒否
    const descendants = await db.getDescendantVersionIds(id);
    for (const parentId of parentIds) {
      if (descendants.has(parentId)) {
        throw new Error('循環が発生するため、その親は指定できません（子孫を親にできません）');
      }
    }

    await db.removeParentRelations(id);
    for (const parentId of parentIds) {
      const parent = await db.getVersionById(parentId);
      if (parent) {
        await db.addRelation(parentId, id);
      }
    }
  }

  // 画像の貼り直し（指定時は総入れ替え）
  if (data.images !== undefined) {
    await db.deleteImagesByVersionId(id);
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      await db.createVersionImage({
        id: generateId(),
        versionId: id,
        imageUrl: img.imageUrl,
        sortOrder: img.sortOrder ?? i,
        caption: img.caption?.trim() || undefined,
      });
    }
  }

  revalidateSpacePaths();

  return fetchVersionDetail(id);
}

export async function deleteExistingVersionRecord(id: string): Promise<boolean> {
  // R2の画像フォルダ（posts/{id}/）を掃除してからDB削除（relation/imageはCASCADE）
  const { deleteAllPostImages } = await import('./storage');
  await deleteAllPostImages(id);

  await db.deleteVersion(id);
  revalidateSpacePaths();

  return true;
}
