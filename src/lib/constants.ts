/**
 * 空白地帯 - 定数定義
 *
 * 「寿命計算」の根拠となる数値と、
 * サイト全体で使用される設定値を定義する。
 */

// ============================================
// Countdown Constants (寿命計算)
// ============================================

/**
 * 月額生活費（円）
 * この数字が「1ヶ月の命」の価値を定義する。
 */
export const MONTHLY_COST = 80_000;

/**
 * 1ヶ月の平均秒数
 * 365.25日 / 12ヶ月 * 24時間 * 60分 * 60秒 = 2,629,800秒
 */
export const SECONDS_PER_MONTH = 2_629_800;

/**
 * 初期資金（円）
 */
export const INITIAL_FUND = 2_300_000;

/**
 * 初期総秒数
 * 2,300,000 / 80,000 * 2,629,800 = 75,587,250秒（約28.75ヶ月）
 */
export const INITIAL_TOTAL_SECONDS = Math.floor(
  (INITIAL_FUND / MONTHLY_COST) * SECONDS_PER_MONTH
);

/**
 * 入金額を秒数に変換する関数
 * @param amount 入金額（円）
 * @returns 追加される秒数
 */
export function amountToSeconds(amount: number): number {
  return Math.floor((amount / MONTHLY_COST) * SECONDS_PER_MONTH);
}

/**
 * 秒数を入金額に変換する関数（逆算用）
 * @param seconds 秒数
 * @returns 相当する金額（円）
 */
export function secondsToAmount(seconds: number): number {
  return Math.floor((seconds / SECONDS_PER_MONTH) * MONTHLY_COST);
}

// ============================================
// Animation Constants (アニメーション設定)
// ============================================

/**
 * アニメーションのデュレーション（秒）
 * 「微弱で有機的」を実現するための遅いトランジション
 */
export const ANIMATION_DURATION = {
  /** ほぼ知覚できない - 0.8秒 */
  whisper: 0.8,
  /** 微かに感じる - 1.2秒 */
  subtle: 1.2,
  /** 穏やかに認識できる - 2.0秒 */
  gentle: 2.0,
} as const;

/**
 * イージング関数
 * 自然界の動きを模倣した曲線
 */
export const ANIMATION_EASING = {
  /** 苔が広がるような緩やかな動き */
  organic: [0.22, 0.61, 0.36, 1],
  /** 露が滴るような動き */
  dew: [0.16, 1, 0.3, 1],
  /** 風に揺れる葉のような動き */
  leaf: [0.34, 1.56, 0.64, 1],
  none: [0, 0, 0, 0]
} as const;

// ============================================
// Visual Constants (視覚設定)
// ============================================

/**
 * カラーパレット
 * 「空白」を強調するための極めて抑制された色彩
 */
export const COLORS = {
  /** 背景の白（純白ではなく、わずかに温かみのある白） */
  void: '#FAFAFA',
  /** テキストの黒（完全な黒ではなく、墨のような深い灰） */
  ink: '#1A1A1A',
  /** 消えかけた文字のような淡い灰 */
  ghost: '#BFBFBF',
  /** マスク境界線の色（ほぼ見えない） */
  edge: '#E8E8E8',
  /** 危機を示す色（警告ではなく、静かな焦燥） */
  critical: '#8B0000',
} as const;

/**
 * 苔胞子パーティクルのデフォルト設定
 * 空間を漂う存在感のない粒子
 */
export const DEFAULT_SPORE_CONFIG = {
  count: 12,
  size: 2,
  opacity: 0.08,
  speed: 0.15,
  color: 'rgba(26, 26, 26, 0.08)',
} as const;

// ============================================
// Discord Constants
// ============================================

/**
 * Discord通知の埋め込み色
 */
export const DISCORD_COLORS = {
  /** 延命 - 静かな喜び（青灰色） */
  lifespan: 0x6B7280,
  /** イベント - 新しい出来事（緑灰色） */
  event: 0x4B5563,
  /** マイルストーン - 節目（紫灰色） */
  milestone: 0x7C3AED,
  /** 危機 - 時間の枯渇（深い赤） */
  critical: 0x8B0000,
} as const;
