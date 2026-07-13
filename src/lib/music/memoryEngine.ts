/**
 * 空白地帯 - Memory Engine
 *
 * History（空間の変容グラフ）を「音の状態」へ翻訳する純粋関数群。AIは使わない。
 *
 * なぜ純粋関数か：
 * - 同じHistoryからは同じ音の状態が導かれる＝「空間の記憶」としての再現性。
 *   music_generation_logに残るMusicStateスナップショットから、
 *   後から「なぜこの音だったか」を辿れる。
 * - 現在時刻(now)も引数で受け取り、テスト・検証を容易にする。
 *
 * 設計原則（CLAUDE.md「Memory Engine」準拠）：
 * - History全件の詳細ではなく「Current Space State + Trend（変化量）」に圧縮する。
 *   Lyriaへ渡すのは数語のweighted promptsだけ——記憶の要約であって記録の複製ではない。
 * - すべて0-1に正規化し、微弱さの上限制御を一箇所でかけられるようにする。
 */

import type {
  VersionGraphData,
  VersionRecord,
  MusicState,
  MusicPromptTemplate,
  MusicWeightedPrompt,
  StemPromptPlan,
  StemRole,
} from '@/types';

// ============================================
// 調律定数
// すべての「翻訳の感度」をここに集約する。
// 音が主張しすぎると感じたら、このセクションだけを触ればよい。
// ============================================

/** trend（変化量）を測る窓。直近30日の記録を「いま動いている」とみなす */
const TREND_WINDOW_DAYS = 30;

/** stillness（静けさ）の地平線。最後の記録から60日で完全な静寂に至る */
const STILLNESS_HORIZON_DAYS = 60;

/** density正規化の飽和点。記録100件で密度1.0（対数スケール） */
const DENSITY_SATURATION_LOG10 = 2;

/** キーワード抽出の対象にする直近レコード数 */
const KEYWORD_SOURCE_COUNT = 5;

/** プロンプトに載せるキーワードの上限（多いと音が主張する） */
const MAX_KEYWORDS = 5;

/**
 * absence（欠落）の世代間減衰率。
 * 削除の気配は一度で消えず、次の生成にも半分だけ残響する——
 * 「消えたものの記憶」も徐々にしか薄れない。
 */
const ABSENCE_DECAY = 0.5;

/** mergeDensityの増幅率。合流は稀な出来事なので、少数でも聴こえる程度に持ち上げる */
const MERGE_AMPLIFY = 4;

// ============================================
// 基本ユーティリティ（名前付き関数で分離：メモリリーク防止ルール準拠）
// ============================================

/** 0-1に丸める。Engineのすべての出力はこの関数を通る */
function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** 記録日時をms epochへ。不正な日付は「存在しない」として扱う（0を返す） */
function toEpoch(isoDate: string): number {
  const t = Date.parse(isoDate);
  return Number.isNaN(t) ? 0 : t;
}

// ============================================
// MusicState 各軸の算出
// ============================================

/**
 * density：記録の密度。
 * 対数正規化により、序盤の1件1件が大きく響き、蓄積するほど変化が緩やかになる
 * ——空間の記憶が堆積していく感覚に対応する。
 */
function computeDensity(versionCount: number): number {
  return clamp01(Math.log10(versionCount + 1) / DENSITY_SATURATION_LOG10);
}

/**
 * trend：直近の変化量。全記録に対する「直近30日の記録」の比率。
 * 空間が活発に変容している時期は音がわずかに目覚め、
 * 手が入らなくなると自然に沈んでいく。
 */
function computeTrend(versions: VersionRecord[], now: Date): number {
  if (versions.length === 0) return 0;
  const windowStart = now.getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let recent = 0;
  for (const v of versions) {
    if (toEpoch(v.createdAt) >= windowStart) recent += 1;
  }
  return clamp01(recent / versions.length);
}

/**
 * branchActivity：分岐の活性。直近30日に記録があったブランチの比率。
 * 複数の枝が同時に動いている＝空間の可能性が枝分かれしている状態を、
 * レイヤーの重なりの厚さへ翻訳する。
 */
function computeBranchActivity(graph: VersionGraphData, now: Date): number {
  if (graph.branches.length === 0) return 0;
  const windowStart = now.getTime() - TREND_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const activeBranchIds = new Set<string>();
  for (const v of graph.versions) {
    if (toEpoch(v.createdAt) >= windowStart) activeBranchIds.add(v.branchId);
  }
  return clamp01(activeBranchIds.size / graph.branches.length);
}

/**
 * mergeDensity：合流の存在感。複数の親を持つ子（＝マージ）の比率。
 * 分かれていた変容が一つに収束した出来事は、和声的な解決として響かせたい。
 * 稀な出来事なのでMERGE_AMPLIFYで持ち上げてから丸める。
 */
function computeMergeDensity(graph: VersionGraphData): number {
  if (graph.versions.length === 0) return 0;
  const parentCounts = new Map<string, number>();
  for (const rel of graph.relations) {
    parentCounts.set(rel.childVersionId, (parentCounts.get(rel.childVersionId) ?? 0) + 1);
  }
  let merges = 0;
  for (const count of parentCounts.values()) {
    if (count >= 2) merges += 1;
  }
  return clamp01((merges / graph.versions.length) * MERGE_AMPLIFY);
}

/**
 * stillness：静けさ。最後の記録からの経過日数を60日地平線で正規化。
 * 誰も手を入れない時間が続くほど音は薄く、遠くなる——
 * 放置もまた空間の状態であり、それを正直に鳴らす。
 */
function computeStillness(versions: VersionRecord[], now: Date): number {
  if (versions.length === 0) return 1; // 記録がない空間は完全な静寂
  let latest = 0;
  for (const v of versions) {
    const t = toEpoch(v.createdAt);
    if (t > latest) latest = t;
  }
  const elapsedDays = (now.getTime() - latest) / (24 * 60 * 60 * 1000);
  return clamp01(elapsedDays / STILLNESS_HORIZON_DAYS);
}

/**
 * absence：欠落（削除された記録の気配）。
 * version_recordsは削除されると行ごと消えるため、直接は観測できない。
 * そこで前回生成時のスナップショット（recordCount）と現在数を比較し、
 * 減少分を欠落として検知する。前回の欠落もABSENCE_DECAYで半減しながら残響する。
 * 再生側はこの値を「一瞬の無音」「密度の低下」として表現する。
 */
function computeAbsence(currentCount: number, previous: MusicState | null): number {
  const carried = (previous?.absence ?? 0) * ABSENCE_DECAY;
  if (!previous || previous.recordCount <= 0) return clamp01(carried);
  const deleted = Math.max(0, previous.recordCount - currentCount);
  const freshAbsence = deleted / previous.recordCount;
  // 新しい欠落と残響のうち、強い方を採用する（加算すると欠落が過剰に響く）
  return clamp01(Math.max(freshAbsence, carried));
}

// ============================================
// キーワード抽出（辞書ベース・AI不使用）
// ============================================

/**
 * 日本語の記録テキスト → Lyriaプロンプト用の英語アンビエント語彙の対訳辞書。
 * なぜ辞書か：AIを使わず、かつ翻訳結果が必ずコンセプト内（微弱・有機的）に
 * 収まることを保証するため。辞書に無い語は音にならない——
 * それは「すべての記憶が音になるわけではない」という選択でもある。
 */
const KEYWORD_DICTIONARY: ReadonlyArray<readonly [string, string]> = [
  ['苔', 'moss'],
  ['光', 'soft light'],
  ['影', 'shadow'],
  ['壁', 'bare wall'],
  ['窓', 'window light'],
  ['土', 'earth'],
  ['石', 'stone'],
  ['木', 'wood grain'],
  ['緑', 'green stillness'],
  ['雨', 'distant rain'],
  ['水', 'water'],
  ['風', 'faint wind'],
  ['夜', 'night air'],
  ['朝', 'morning haze'],
  ['夕', 'dusk'],
  ['冬', 'winter quiet'],
  ['春', 'early spring'],
  ['夏', 'summer humidity'],
  ['秋', 'autumn fading'],
  ['白', 'white space'],
  ['黒', 'deep dark'],
  ['音', 'resonance'],
  ['声', 'distant voices'],
  ['床', 'wooden floor'],
  ['天井', 'high ceiling'],
  ['埃', 'floating dust'],
  ['錆', 'rust texture'],
  ['布', 'soft fabric'],
  ['紙', 'paper rustle'],
  ['灯', 'dim lamp'],
];

/**
 * 直近の記録（title / memory / reason）から辞書ヒットを抽出する。
 * memoryフィールド（定量化しにくい出来事・記憶）を含めるのは、
 * まさにそのナラティブこそが「空間の記憶」の中心だから。
 */
function extractKeywords(versions: VersionRecord[]): string[] {
  const sorted = [...versions].sort(compareByCreatedAtDesc);
  const recent = sorted.slice(0, KEYWORD_SOURCE_COUNT);
  const found: string[] = [];
  for (const record of recent) {
    const text = `${record.title} ${record.memory ?? ''} ${record.reason ?? ''}`;
    for (const [ja, en] of KEYWORD_DICTIONARY) {
      if (found.length >= MAX_KEYWORDS) return found;
      if (text.includes(ja) && !found.includes(en)) {
        found.push(en);
      }
    }
  }
  return found;
}

/** createdAt降順ソート用の名前付き比較関数（インラインアロー回避） */
function compareByCreatedAtDesc(a: VersionRecord, b: VersionRecord): number {
  return toEpoch(b.createdAt) - toEpoch(a.createdAt);
}

// ============================================
// MusicState の合成
// ============================================

/**
 * HistoryグラフをMusicStateへ翻訳する（Engineの中心・純粋関数）。
 *
 * @param graph    fetchVersionGraph()の結果
 * @param previous 前回生成時のスナップショット（music_generation_logから）。初回はnull
 * @param now      現在時刻（テスト容易性のため注入する）
 */
export function computeMusicState(
  graph: VersionGraphData,
  previous: MusicState | null,
  now: Date,
): MusicState {
  return {
    density: computeDensity(graph.versions.length),
    trend: computeTrend(graph.versions, now),
    branchActivity: computeBranchActivity(graph, now),
    mergeDensity: computeMergeDensity(graph),
    stillness: computeStillness(graph.versions, now),
    absence: computeAbsence(graph.versions.length, previous),
    recordCount: graph.versions.length,
    keywords: extractKeywords(graph.versions),
    computedAt: now.toISOString(),
  };
}

// ============================================
// weighted prompts 生成
// ============================================

/**
 * 数値を言葉へ。Lyriaには数値ではなく形容で渡す。
 * どの段階でも「疎ら」を基調にする——密度が最大でも"gentle"止まり。
 * 派手な形容詞がここに存在しないこと自体が、禁止事項の実装である。
 */
function describeDensity(density: number, absence: number): string {
  // 欠落の気配があるときは、密度を一段引き下げて「欠け」を聴かせる
  const effective = clamp01(density * (1 - absence * 0.5));
  if (effective < 0.25) return 'almost silent, vast empty space between sounds';
  if (effective < 0.5) return 'very sparse, long silences';
  if (effective < 0.75) return 'sparse, unhurried';
  return 'gentle, quietly layered';
}

/** trend（変化量）の形容。動いていても「目覚めかけ」まで */
function describeTrend(trend: number): string {
  if (trend < 0.2) return 'settled deep in stillness';
  if (trend < 0.5) return 'slowly shifting, barely perceptible motion';
  return 'quietly awakening, subtle organic movement';
}

/** キーワードの形容。辞書ヒットが無い日は「がらんどう」を鳴らす */
function describeKeywords(keywords: string[]): string {
  if (keywords.length === 0) return 'hollow empty room, untouched space';
  return keywords.join(', ');
}

/**
 * テンプレートのプレースホルダをMusicStateの言語化で置換する。
 * 管理画面のテンプレートが自由記述でも、埋め込まれる値は
 * 必ずEngineの語彙（微弱寄り）に限定される。
 */
function fillTemplate(template: string, state: MusicState): string {
  return template
    .replaceAll('{keywords}', describeKeywords(state.keywords))
    .replaceAll('{density}', describeDensity(state.density, state.absence))
    .replaceAll('{trend}', describeTrend(state.trend));
}

/**
 * stem役割ごとの重みをMusicStateから導く。
 *
 * 重みの思想：
 * - atmosphere（空気感）が常に主役。空白地帯の音の80%は「間」であるべきで、
 *   その間を支えるのは持続する空気の層。
 * - rhythmは密度に比例するが基礎値が最も低い。欠落(absence)はまずリズムを削る
 *   ——拍が抜けることが「一瞬の無音」の種になる。
 * - melodyはtrend（いま動いているか）にのみ反応する。動きのない空間で
 *   旋律だけが歌うのは嘘になる。
 * - bassはstillnessが深いほど沈む（薄れる）が、完全には消えない。
 *   空間が在る限り、地鳴りのような記憶の低音は残る。
 */
function stemWeight(role: StemRole, state: MusicState): number {
  switch (role) {
    case 'rhythm':
      return 0.1 + 0.4 * state.density * (1 - state.absence);
    case 'bass':
      return 0.3 + 0.2 * (1 - state.stillness);
    case 'melody':
      return 0.15 + 0.45 * state.trend + 0.15 * state.mergeDensity;
    case 'atmosphere':
      return 0.5 + 0.3 * state.stillness + 0.2 * state.branchActivity;
  }
}

/** 重みの下限。どのstemも完全なゼロにはしない（急激な消失は「派手な変化」になるため） */
const MIN_WEIGHT = 0.05;

/** 重みの合計の目標値。steer時に全体音圧が世代間で揺れないよう一定に保つ */
const TOTAL_WEIGHT = 2.0;

/**
 * MusicState × テンプレート → stem役割つきプロンプト計画。
 *
 * 各stem役割につき、有効(isActive)かつsortOrder最小のテンプレートを1つ採用する。
 * 重みは合計TOTAL_WEIGHTに正規化：Historyがどう変化しても全体の音圧は一定で、
 * 変わるのは「配分」だけ——音楽が途切れず・跳ねずに続くための土台。
 * 生成層はroleを見てキャプチャ区間ごとのmute設定を組み立てる。
 */
export function buildStemPromptPlans(
  state: MusicState,
  templates: MusicPromptTemplate[],
): StemPromptPlan[] {
  const chosen = pickActiveTemplates(templates);
  if (chosen.length === 0) return [];

  const rawWeights = chosen.map(function weighTemplate(tpl) {
    return Math.max(MIN_WEIGHT, stemWeight(tpl.stemRole, state));
  });
  const sum = rawWeights.reduce(sumReducer, 0);

  return chosen.map(function toPlan(tpl, index): StemPromptPlan {
    return {
      role: tpl.stemRole,
      text: fillTemplate(tpl.template, state),
      // 小数3桁に丸める：ログ(music_generation_log.prompts)を人が読める形に保つ
      weight: Math.round((rawWeights[index] / sum) * TOTAL_WEIGHT * 1000) / 1000,
    };
  });
}

/**
 * 役割を落とした素のweighted prompts（ログ保存・Lyria送信用の形）。
 * buildStemPromptPlansの投影であり、翻訳ロジックは一箇所に保つ。
 */
export function buildWeightedPrompts(
  state: MusicState,
  templates: MusicPromptTemplate[],
): MusicWeightedPrompt[] {
  return buildStemPromptPlans(state, templates).map(stripRole);
}

/** StemPromptPlan → MusicWeightedPrompt への射影（名前付き関数） */
function stripRole(plan: StemPromptPlan): MusicWeightedPrompt {
  return { text: plan.text, weight: plan.weight };
}

/** stem役割ごとに有効テンプレートを1つ選ぶ（sortOrder昇順の先頭） */
function pickActiveTemplates(templates: MusicPromptTemplate[]): MusicPromptTemplate[] {
  const byRole = new Map<StemRole, MusicPromptTemplate>();
  const sorted = [...templates].sort(compareBySortOrder);
  for (const tpl of sorted) {
    if (tpl.isActive && !byRole.has(tpl.stemRole)) {
      byRole.set(tpl.stemRole, tpl);
    }
  }
  return [...byRole.values()];
}

/** sortOrder昇順ソート用の名前付き比較関数 */
function compareBySortOrder(a: MusicPromptTemplate, b: MusicPromptTemplate): number {
  return a.sortOrder - b.sortOrder;
}

/** reduce用の名前付き加算関数 */
function sumReducer(acc: number, value: number): number {
  return acc + value;
}
