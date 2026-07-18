/**
 * 空白地帯 - Music Mode 型定義
 *
 * The music is the audible memory of the space.
 * Historyページの変容（コミット・分岐・合流・記憶）を音に翻訳するための型。
 *
 * 設計原則：
 * - Lyria呼び出しは「記憶の採取」（1日最大3回）。日常の再生はR2のstemsを
 *   Web Audio APIがルールベースで重ね直すだけ＝コストゼロで常に新しい。
 * - すべての数値は 0-1 に正規化し、「微弱」の上限をかけやすくする。
 */

// ============================================
// 更新モード
// ============================================

/**
 * 更新モード。
 * - auto:   Cron（朝・昼・晩）でHistoryを取り込み自動再構築。
 * - manual: 自動更新を完全停止。管理画面の「Rebuild Ensemble」でのみ再構築。
 * デフォルトはmanual（コスト安全側に倒す）。
 */
export type MusicUpdateMode = 'auto' | 'manual';

/**
 * 音楽設定（D1のmusic_settings単一行に対応）。
 * 全セッション（プレイヤー側・管理側）がこの1行を参照して同じ状態を共有する。
 */
export interface MusicSettings {
  /** 更新モード */
  mode: MusicUpdateMode;
  /** Auto時の生成時刻（JST "HH:MM"）朝 */
  scheduleMorning: string;
  /** Auto時の生成時刻（JST "HH:MM"）昼 */
  scheduleNoon: string;
  /** Auto時の生成時刻（JST "HH:MM"）晩 */
  scheduleEvening: string;
  /** 生成中フラグ（二重生成防止ロック） */
  isGenerating: boolean;
  /** 更新日時 */
  updatedAt: string;
}

// ============================================
// 擬似stem
// ============================================

/**
 * 擬似stemの役割。
 * Lyriaは真のstem分離を提供しないため、1セッション内でsteerして
 * 4つの音色域を順にキャプチャし、ブラウザ側で重ね直す。
 */
export type StemRole = 'rhythm' | 'bass' | 'melody' | 'atmosphere';

/** 全stem役割の固定順序（生成時のキャプチャ順もこの順） */
export const STEM_ROLES: readonly StemRole[] = ['rhythm', 'bass', 'melody', 'atmosphere'] as const;

/**
 * 生成済みstemのメタデータ（D1のmusic_stemsに対応）。
 * urlはR2の公開URL。再生はこれを取得して重ねるだけ。
 */
export interface MusicStem {
  /** 一意識別子 */
  id: string;
  /** 生成ログID（どの採取で生まれた音か） */
  generationId: string;
  /** stemの役割 */
  stemRole: StemRole;
  /** R2上のオブジェクトキー */
  r2Key: string;
  /** 公開URL */
  url: string;
  /** 長さ（秒） */
  durationSec: number;
  /** 現行アンサンブルの一部か */
  isCurrent: boolean;
  /** 作成日時 */
  createdAt: string;
}

/**
 * 1世代分のstems一式（記憶の地層の1層）。
 * createdAtは風化（経過時間）と時刻の共鳴（採取時間帯）の判定に使う。
 */
export interface GenerationStems {
  /** 世代ID（= music_generation_log.id） */
  id: string;
  /** 採取日時（ISO 8601） */
  createdAt: string;
  /** この世代の擬似stems */
  stems: MusicStem[];
}

/**
 * クライアントへ配信するアンサンブル一式。
 * /api/music/manifest のレスポンス。APIキー等の秘匿情報は一切含まない。
 */
export interface StemManifest {
  /** 現行の4 stems（生成前は空配列＝音は鳴らない、それも空白） */
  stems: MusicStem[];
  /** 生成時点のMusicState（ビジュアライザー・ミックスルールの入力） */
  musicState: MusicState | null;
  /** 最終生成日時（ISO 8601）。クライアントはこれの変化で差し替えを検知する */
  generatedAt: string | null;
  /**
   * 記憶の地層：直近N世代（新しい順、現行世代を含む）。
   * URLのメタデータのみ——音声データは章（Chapter）が選んだ時に初めて取得される。
   * 既存クライアントはこのフィールドを無視しても従来どおり動く（後方互換）。
   */
  generations: GenerationStems[];
}

// ============================================
// Memory Engine（History → 音の状態）
// ============================================

/**
 * Historyグラフから抽出した「空間の現在の状態＋変化の傾向」。
 * 全件の詳細ではなくCurrent State + Trendに圧縮する（コスト・連続性重視）。
 * すべて0-1に正規化し、微弱さの上限制御を一箇所でかけられるようにする。
 */
export interface MusicState {
  /** 記録の密度（バージョン数の対数正規化）→ リズムの疎密へ */
  density: number;
  /** 直近の変化量（最近30日のコミット比率）→ 音の明るさ・動きへ */
  trend: number;
  /** 分岐の活性（ブランチ数・未合流の枝）→ レイヤーの重なり方へ */
  branchActivity: number;
  /** 合流（マージ）の存在感 → 和声的な収束へ */
  mergeDensity: number;
  /** 最新の記録からの経過による「静けさ」（古いほど1に近づく）→ 全体音量の減衰へ */
  stillness: number;
  /**
   * 欠落（削除された記録の気配）。
   * 前回スナップショットとの件数差で検知し、世代を跨いで減衰する。
   * 再生側では「一瞬の無音」や密度の低下として表現する——
   * 消えた記録は音でも「欠け」として現れる。
   */
  absence: number;
  /**
   * 記録の生数（正規化しない唯一の値）。
   * 次回の生成時に前回スナップショットと比較して削除＝欠落を検知するために保持する。
   */
  recordCount: number;
  /** 直近の記録のタイトル・記憶から抽出したキーワード（プロンプト用、最大5語） */
  keywords: string[];
  /** 算出時刻（ISO 8601） */
  computedAt: string;
}

/**
 * Lyria RealTimeへ送るweighted prompt。
 * @google/genai のWeightedPromptと同形だが、SDKに依存しないよう自前で定義する。
 */
export interface MusicWeightedPrompt {
  /** プロンプト本文（テンプレートのプレースホルダ置換済み） */
  text: string;
  /** 重み（steerの強さ。合計が偏りすぎないようEngine側で正規化） */
  weight: number;
}

/**
 * stem役割つきのプロンプト計画。
 * 生成層（lyria.ts）はこの役割を見て、キャプチャ区間ごとの
 * mute設定（ドラムのみ・ベースのみ等）を組み立てる。
 */
export interface StemPromptPlan extends MusicWeightedPrompt {
  /** このプロンプトが担う擬似stemの役割 */
  role: StemRole;
}

// ============================================
// プロンプトテンプレート
// ============================================

/**
 * 管理画面で編集できるstem別プロンプトテンプレート。
 * {keywords} {density} {trend} プレースホルダをMemory Engineが実値で置換する。
 */
export interface MusicPromptTemplate {
  /** 一意識別子 */
  id: string;
  /** 表示名 */
  name: string;
  /** 対象stem */
  stemRole: StemRole;
  /** テンプレート本文 */
  template: string;
  /** 有効か（無効化しても削除はしない＝記録を残す） */
  isActive: boolean;
  /** 表示順 */
  sortOrder: number;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
}

// ============================================
// 使用ログ（コスト管理）
// ============================================

/** 生成のトリガー種別 */
export type MusicTriggerType = 'auto' | 'manual';

/**
 * 生成ステータス。
 * - started: セッション開始（完了前にWorkerが落ちた場合の検出にも使う）
 * - success: stems保存まで完了
 * - failed:  エラー終了（errorに理由）
 * - skipped: 上限到達・Manual時のCron・ロック中などで実行しなかった
 */
export type MusicGenerationStatus = 'started' | 'success' | 'failed' | 'skipped';

/**
 * Lyria呼び出しの使用ログ（D1のmusic_generation_logに対応）。
 * 「1日最大3回」はこのログの当日成功件数をサーバ側でカウントして強制する。
 */
export interface MusicGenerationLog {
  /** 一意識別子 */
  id: string;
  /** トリガー種別 */
  triggerType: MusicTriggerType;
  /** ステータス */
  status: MusicGenerationStatus;
  /** 生成時点のMusicState（JSONパース済み） */
  musicState: MusicState | null;
  /** 実際に送ったweighted prompts（JSONパース済み） */
  prompts: MusicWeightedPrompt[] | null;
  /** エラー内容（failed時） */
  error?: string;
  /** 所要時間（ミリ秒） */
  durationMs?: number;
  /** 作成日時 */
  createdAt: string;
}
