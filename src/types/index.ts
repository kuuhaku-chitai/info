/**
 * 空白地帯 - 型定義
 *
 * このファイルはプロジェクト全体で使用される型を定義する。
 * 「未完」を表現するため、すべてのデータは「いつか消える」前提で設計されている。
 */

// ============================================
// KV Data Schema
// ============================================

/**
 * 投稿のカテゴリ
 * - event: カレンダーに表示されるイベント（展示、パフォーマンス等）
 * - article: 長文の記事（エッセイ、批評等）
 * - note: 短いメモ、断片的な思考
 * - news: お知らせ（トップページに表示される重要な告知）
 */
export type PostCategory = 'event' | 'article' | 'note' | 'news';

/**
 * 投稿データ
 * すべての投稿は同じスキーマを共有し、categoryで分類される。
 * これは「すべてのコンテンツは等価」という思想を反映している。
 */
export interface Post {
  /** 一意識別子 (ULID推奨 - 時系列ソート可能) */
  id: string;
  /** 投稿タイトル */
  title: string;
  /** 作成日時 (ISO 8601) */
  date: string;
  /** Markdownコンテンツ */
  markdown: string;
  /** 投稿カテゴリ */
  category: PostCategory;
  /** タグ（空白で区切られた概念を繋ぐ） */
  tags: string[];
  /** 公開状態 */
  isPublished: boolean;
  /** サムネイル画像URL（オプション - 画像がないことも「空白」） */
  thumbnailUrl?: string;
  /** イベントの場合の開始日時 (ISO 8601) */
  eventStartDate?: string;
  /** イベントの場合の終了日時 (ISO 8601) */
  eventEndDate?: string;
  /** 最終更新日時 (ISO 8601) */
  updatedAt: string;
  /** 紐づくプロジェクトID（紐づいた投稿は /blog に表示されない） */
  projectId?: string;
}

// ============================================
// プロジェクト
// ============================================

/**
 * プロジェクトデータ
 * 投稿と同じ構造を持ち、関連記事を束ねる単位として機能する。
 */
export interface Project {
  id: string;
  title: string;
  date: string;
  markdown: string;
  category: PostCategory;
  tags: string[];
  isPublished: boolean;
  thumbnailUrl?: string;
  eventStartDate?: string;
  eventEndDate?: string;
  updatedAt: string;
}

/**
 * カウントダウンの状態
 * 「寿命」を管理するデータ構造
 */
export interface CountdownState {
  /** 開始日時 (ISO 8601) - プロジェクトの「誕生」 */
  startDate: string;
  /** 初期総秒数 (75,587,250秒 = 約28.75ヶ月) */
  initialTotalSeconds: number;
  /** 延命により追加された秒数の累計 */
  addedSeconds: number;
  /** 最終更新日時 */
  updatedAt: string;
}

/**
 * 入金記録
 * 「延命」の履歴を保持する
 */
export interface Donation {
  id: string;
  /** 入金額（円） */
  amount: number;
  /** 追加された秒数 (amount / 80000 * 2629800) */
  addedSeconds: number;
  /** 入金日時 */
  date: string;
  /** メモ（オプション） */
  note?: string;
}

// ============================================
// ソーシャルリンク
// ============================================

/**
 * ソーシャルリンクデータ
 * 外部SNS等へのリンクを管理
 */
export interface SocialLink {
  /** 一意識別子 */
  id: string;
  /** リンクタイトル（例: Twitter, Instagram） */
  title: string;
  /** リンクURL */
  url: string;
  /** アイコン画像URL */
  iconUrl: string;
  /** 表示順序（小さいほど先に表示） */
  sortOrder: number;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

// ============================================
// Discord Notification Types
// ============================================

/**
 * Discord通知の種類
 * - lifespan: 延命通知（入金があった時）
 * - event: 新規イベント公開通知
 * - milestone: マイルストーン通知（残り100日など）
 * - critical: 緊急通知（残り30日以下など）
 */
export type NotificationType = 'lifespan' | 'event' | 'milestone' | 'critical';

/**
 * Discord Webhook ペイロード
 */
export interface DiscordNotificationPayload {
  type: NotificationType;
  message: string;
  /** 埋め込みデータ（オプション） */
  embed?: {
    title?: string;
    description?: string;
    color?: number;
    timestamp?: string;
  };
}

// ============================================
// UI Component Types
// ============================================

/**
 * アニメーションの「強度」
 * すべてのアニメーションは「微弱」が基本。
 * これは「空白」を邪魔しないためのルール。
 */
export type AnimationIntensity = 'whisper' | 'subtle' | 'gentle';

/**
 * 苔胞子パーティクルの設定
 * 空間を漂う微細な粒子のパラメータ
 */
export interface SporeParticleConfig {
  /** 粒子の数（少ないほど「空白」が強調される） */
  count: number;
  /** 粒子の大きさ (px) */
  size: number;
  /** 透明度 (0-1, 低いほど存在感が薄い) */
  opacity: number;
  /** 移動速度 (px/frame) */
  speed: number;
  /** 色 (RGBA) */
  color: string;
}
