/**
 * 空白地帯 - 型定義
 *
 * このファイルはプロジェクト全体で使用される型を定義する。
 * 「未完」を表現するため、すべてのデータは「いつか消える」前提で設計されている。
 */

// ============================================
// 認証
// ============================================

/**
 * 管理者ユーザー
 * パスワードハッシュは含まない（クライアントに渡さないため）
 */
export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

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
  /** 著者ID（管理者ユーザーへの参照） */
  authorId?: string;
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
  /** 著者ID（管理者ユーザーへの参照） */
  authorId?: string;
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
  /** 月額コスト（円） */
  monthlyCost: number;
  /** 初期資金（円） */
  initialFund: number;
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
export type NotificationType = 'lifespan' | 'event' | 'milestone' | 'critical' | 'inquiry';

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
// 問い合わせ
// ============================================

/**
 * 問い合わせ種別
 * - general: 一般的な問い合わせ
 * - collaboration: コラボレーション・協業
 * - commission: 制作依頼
 * - media: 取材・メディア関連
 * - other: その他
 */
export type InquiryType = 'general' | 'collaboration' | 'commission' | 'media' | 'other';

/**
 * 問い合わせデータ
 * フォームから送信された問い合わせを保持する
 */
export interface ContactInquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  inquiryType: InquiryType;
  message: string;
  isRead: boolean;
  isReplied: boolean;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================
// 固定ページ
// ============================================

/**
 * 固定ページデータ
 * 投稿やプロジェクトとは異なり、カテゴリやタグを持たない。
 * URLパス（concept, aboutなど）で公開される。
 */
export interface Page {
  /** 一意識別子 */
  id: string;
  /** ページタイトル */
  title: string;
  /** URLパス（例: concept, about） */
  path: string;
  /** Markdownコンテンツ */
  markdown: string;
  /** 公開状態 */
  isPublished: boolean;
  /** アイキャッチ画像URL */
  thumbnailUrl?: string;
  /** メニューでの表示順序（小さいほど先に表示） */
  sortOrder: number;
  /** 著者ID */
  authorId?: string;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

// ============================================
// 物理的バージョン管理（空間のGit / DAG）
// ============================================

/**
 * ブランチ。変更履歴を束ねる単位（Gitのbranchに相当）。
 * 例: 「2026春レイアウト」「ギャラリー化計画」
 */
export interface SpaceBranch {
  /** 一意識別子 */
  id: string;
  /** ブランチ名 */
  name: string;
  /** 説明 */
  description?: string;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

/**
 * バージョン。変更履歴の本体（Gitのcommitに相当）。
 * 空間の「変容」と、そこに宿る「記憶（memory）」を1つの記録に束ねる。
 */
export interface VersionRecord {
  /** 一意識別子 */
  id: string;
  /** 所属ブランチID */
  branchId: string;
  /** 変更のタイトル */
  title: string;
  /** 変更内容（Markdown） */
  content: string;
  /** 変更理由 */
  reason?: string;
  /** その場所で起きた、定量化しにくい出来事・記憶（ナラティブ） */
  memory?: string;
  /** 空間内の具体的な位置に関するメモ */
  locationNote?: string;
  /** 変更者（自由記述） */
  author?: string;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

/**
 * バージョン間の親子エッジ。
 * 1つの child に複数の parent が存在する場合、それが「マージ（合流）」を意味する。
 */
export interface VersionRelation {
  /** 派生元（親）のバージョンID */
  parentVersionId: string;
  /** 派生先（子）のバージョンID */
  childVersionId: string;
  /** 作成日時 */
  createdAt: string;
}

/**
 * バージョンに紐づく画像（R2のメタデータ）。
 * sortOrder で「変更前・変更中・変更後」などの表示順を制御する。
 */
export interface VersionRecordImage {
  /** 一意識別子 */
  id: string;
  /** 紐づくバージョンID */
  versionId: string;
  /** R2上の画像URL */
  imageUrl: string;
  /** 表示順（小さいほど先） */
  sortOrder: number;
  /** 画像へのメモ */
  caption?: string;
  /** 作成日時 */
  createdAt: string;
}

/**
 * バージョンの詳細（画像・親エッジを同梱）。
 * 詳細パネルや編集フォームでまとめて扱うための合成型。
 */
export interface VersionRecordDetail extends VersionRecord {
  /** 紐づく画像（sortOrder昇順） */
  images: VersionRecordImage[];
  /** 親バージョンのID（複数 = マージの合流元） */
  parentIds: string[];
}

/**
 * グラフ描画用のDAGデータ一式（React Flow用 / Step 4）。
 */
export interface VersionGraphData {
  branches: SpaceBranch[];
  versions: VersionRecord[];
  relations: VersionRelation[];
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
