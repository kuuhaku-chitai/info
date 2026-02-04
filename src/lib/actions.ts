'use server';

/**
 * 空白地帯 - Server Actions
 *
 * すべてのデータ操作はServer Actionsを通じて行う。
 * D1（本番）とSQLite（ローカル）に対応。
 */

import { revalidatePath } from 'next/cache';
import { type Post, type Donation, type CountdownState } from '@/types';
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
  revalidatePath('/');

  return updated;
}

export async function deleteExistingPost(id: string): Promise<boolean> {
  await db.deletePost(id);

  revalidatePath('/admin');
  revalidatePath('/admin/posts');
  revalidatePath('/blog');
  revalidatePath('/schedule');
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
