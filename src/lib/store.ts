/**
 * 空白地帯 - データストア
 *
 * 開発環境ではファイルベースのJSON storage、
 * 本番環境ではCloudflare Workers KVに切り替え可能な
 * 抽象化レイヤー。
 *
 * すべてのデータは「消えゆく」前提で設計されている。
 */

import { type Post, type CountdownState, type Donation } from '@/types';
import { INITIAL_TOTAL_SECONDS, MONTHLY_COST, INITIAL_FUND } from './constants';

// ============================================
// データ構造
// ============================================

export interface StoreData {
  countdown: CountdownState;
  posts: Post[];
  donations: Donation[];
}

// ============================================
// 初期データ
// ============================================

/**
 * プロジェクト開始日
 * この日から「寿命」のカウントダウンが始まる
 */
const PROJECT_START_DATE = '2025-02-01T00:00:00.000Z';

export const initialStoreData: StoreData = {
  countdown: {
    startDate: PROJECT_START_DATE,
    initialTotalSeconds: INITIAL_TOTAL_SECONDS,
    addedSeconds: 0,
    monthlyCost: MONTHLY_COST,
    initialFund: INITIAL_FUND,
    updatedAt: PROJECT_START_DATE,
  },
  posts: [],
  donations: [],
};

// ============================================
// インメモリストア（開発用）
// ============================================

/**
 * 開発用のインメモリストア
 * サーバー再起動でリセットされる
 *
 * 本番ではこれをWorkers KVに置き換える
 */
let memoryStore: StoreData = { ...initialStoreData };

// ============================================
// ストアAPI
// ============================================

/**
 * ストア全体を取得
 */
export function getStore(): StoreData {
  return memoryStore;
}

/**
 * ストア全体を更新
 */
export function setStore(data: StoreData): void {
  memoryStore = data;
}

/**
 * カウントダウン状態を取得
 */
export function getCountdownState(): CountdownState {
  return memoryStore.countdown;
}

/**
 * カウントダウン状態を更新
 */
export function updateCountdownState(
  update: Partial<CountdownState>
): CountdownState {
  memoryStore.countdown = {
    ...memoryStore.countdown,
    ...update,
    updatedAt: new Date().toISOString(),
  };
  return memoryStore.countdown;
}

// ============================================
// 投稿API
// ============================================

/**
 * すべての投稿を取得
 */
export function getAllPosts(): Post[] {
  return memoryStore.posts;
}

/**
 * 公開済みの投稿を取得
 */
export function getPublishedPosts(): Post[] {
  return memoryStore.posts
    .filter((post) => post.isPublished)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * カテゴリ別に投稿を取得
 */
export function getPostsByCategory(category: Post['category']): Post[] {
  return getPublishedPosts().filter((post) => post.category === category);
}

/**
 * IDで投稿を取得
 */
export function getPostById(id: string): Post | undefined {
  return memoryStore.posts.find((post) => post.id === id);
}

/**
 * 投稿を作成
 */
export function createPost(post: Post): Post {
  memoryStore.posts.push(post);
  return post;
}

/**
 * 投稿を更新
 */
export function updatePost(id: string, update: Partial<Post>): Post | undefined {
  const index = memoryStore.posts.findIndex((post) => post.id === id);
  if (index === -1) return undefined;

  memoryStore.posts[index] = {
    ...memoryStore.posts[index],
    ...update,
    updatedAt: new Date().toISOString(),
  };
  return memoryStore.posts[index];
}

/**
 * 投稿を削除
 */
export function deletePost(id: string): boolean {
  const index = memoryStore.posts.findIndex((post) => post.id === id);
  if (index === -1) return false;

  memoryStore.posts.splice(index, 1);
  return true;
}

// ============================================
// 入金API
// ============================================

/**
 * すべての入金を取得
 */
export function getAllDonations(): Donation[] {
  return memoryStore.donations.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * 入金累計を取得
 */
export function getTotalDonationAmount(): number {
  return memoryStore.donations.reduce((sum, d) => sum + d.amount, 0);
}

/**
 * 入金を記録（延命処理も同時に行う）
 */
export function recordDonation(donation: Donation): Donation {
  memoryStore.donations.push(donation);

  // カウントダウンに延命を適用
  memoryStore.countdown.addedSeconds += donation.addedSeconds;
  memoryStore.countdown.updatedAt = new Date().toISOString();

  return donation;
}

/**
 * 入金を削除（延命も取り消す）
 */
export function deleteDonation(id: string): boolean {
  const donation = memoryStore.donations.find((d) => d.id === id);
  if (!donation) return false;

  // 延命を取り消す
  memoryStore.countdown.addedSeconds -= donation.addedSeconds;
  memoryStore.countdown.updatedAt = new Date().toISOString();

  // 入金を削除
  const index = memoryStore.donations.findIndex((d) => d.id === id);
  memoryStore.donations.splice(index, 1);

  return true;
}

// ============================================
// 統計API
// ============================================

export interface StoreStats {
  totalPosts: number;
  publishedPosts: number;
  upcomingEvents: number;
  totalDonations: number;
  totalDonationAmount: number;
  addedSeconds: number;
}

/**
 * 統計情報を取得
 */
export function getStats(): StoreStats {
  const now = new Date();

  return {
    totalPosts: memoryStore.posts.length,
    publishedPosts: memoryStore.posts.filter((p) => p.isPublished).length,
    upcomingEvents: memoryStore.posts.filter(
      (p) =>
        p.category === 'event' &&
        p.isPublished &&
        p.eventStartDate &&
        new Date(p.eventStartDate) > now
    ).length,
    totalDonations: memoryStore.donations.length,
    totalDonationAmount: getTotalDonationAmount(),
    addedSeconds: memoryStore.countdown.addedSeconds,
  };
}
