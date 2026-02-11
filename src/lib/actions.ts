'use server';

/**
 * 空白地帯 - Server Actions
 *
 * すべてのデータ操作はServer Actionsを通じて行う。
 * D1（本番）とSQLite（ローカル）に対応。
 */

import { revalidatePath } from 'next/cache';
import { type Post, type Project, type Donation, type CountdownState, type SocialLink } from '@/types';
import { amountToSeconds } from './constants';
import * as db from './db';
import { notifyLifespanExtension, notifyNewEvent } from './discord';
import { calculateRemainingSeconds } from './countdown';

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
  data: Omit<Post, 'id' | 'updatedAt'>
): Promise<Post> {
  const now = new Date().toISOString();
  const post: Post = {
    ...data,
    id: generateId(),
    updatedAt: now,
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
  const addedSeconds = amountToSeconds(data.amount);
  const addedDays = Math.floor(addedSeconds / (24 * 60 * 60));

  const donation: Donation = {
    ...data,
    id: generateId(),
    addedSeconds,
  };

  await db.createDonation(donation);

  // 延命通知をDiscordに送信
  const countdown = await db.getCountdown();
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
  data: Omit<Project, 'id' | 'updatedAt'>
): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    ...data,
    id: generateId(),
    updatedAt: now,
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
