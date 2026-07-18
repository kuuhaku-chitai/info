/**
 * 空白地帯 - 章のルール（記憶の地層・純粋関数・AI不使用）
 *
 * 呼吸（60秒）より一段深い周期「章」（5分）ごとに、
 * 過去のどの世代（記憶）が浮かび上がるかを決める。
 *
 * 設計原則（plan-memory-strata.md §1）：
 * - 記憶の風化：古い世代ほど淡く（ゲイン減衰）・こもる（ローパス）。
 *   HistoryGraphのノード風化と同じ思想を音に適用する。
 * - 時刻の共鳴（案イ）：採取された時間帯と現在の時間帯が一致する記憶が
 *   優先して浮かぶ——「その時刻の空気は、同じ時刻に戻ってくる」。
 * - 記憶が浮かばない章もある：候補があっても確率で沈黙の章になる。
 *   記憶は必ず戻るとは限らない。
 * - すべて決定的（mulberry32、章番号が種）＝テスト可能な偶然。
 *
 * このモジュールは「どの記憶を、どの層で、どれくらい微かに」だけを決める。
 * 実際に鳴らすか（休んでいる層との交差・確率適用）はエンジン側の呼吸周期が判定する。
 */

import type { StemRole } from '@/types';

/** 章の長さ（秒）。ネットワーク・デコード負荷もこの周期に閉じ込められる */
export const CHAPTER_CYCLE_SEC = 300;

/** 章ごとに記憶が実際に呼吸周期へ現れる確率（承認済み既定値） */
const SURFACE_PROBABILITY = 0.4;

/** 候補があっても章ごと沈黙する確率——記憶は必ず戻るとは限らない */
const SILENT_CHAPTER_PROBABILITY = 0.25;

/** 風化の半減期（日）。30日で気配が半分に */
const WEATHERING_HALF_LIFE_DAYS = 30;

/** 風化ゲインの上限：どんなに新しい記憶も現在の半分より前に出ない */
const WEATHERING_GAIN_CEILING = 0.5;

/** 風化ゲインの下限（承認済み既定値）：完全には消えない */
const WEATHERING_GAIN_FLOOR = 0.15;

/** ローパスの範囲：新しい記憶は明瞭(8kHz)、老いた記憶はこもる(1.2kHz) */
const LOWPASS_MAX_HZ = 8000;
const LOWPASS_MIN_HZ = 1200;

/**
 * echoが滲める層。atmosphereは含めない：
 * 現在のatmosphereは決して休まないため「休んだ場所に滲む」対象にならず、
 * 重ねると空気の層だけが厚くなって空白を侵す。
 */
const ECHO_ROLES: readonly StemRole[] = ['rhythm', 'melody', 'bass'];

/** 章の判定に必要な世代情報の最小形（GenerationStemsの部分集合） */
export interface GenerationSummary {
  id: string;
  createdAt: string;
}

/** 1章分の計画：どの記憶を、どの層で、どれくらい微かに */
export interface EchoPlan {
  /** 浮かぶ世代。nullの章は記憶が浮かばない（それも空白） */
  generationId: string | null;
  /** 滲む候補の層（最大2。実際に鳴るのは現在が休んでいる層との交差のみ） */
  roles: StemRole[];
  /** 風化ゲイン倍率 0.15-0.5 */
  gainMul: number;
  /** 風化ローパス（Hz）1200-8000 */
  lowpassHz: number;
  /** 呼吸周期ごとに実際に現れる確率 */
  surfaceProbability: number;
}

/** 記憶が浮かばない章（候補なし・沈黙の章の両方で使う） */
function silentChapter(): EchoPlan {
  return {
    generationId: null,
    roles: [],
    gainMul: 0,
    lowpassHz: LOWPASS_MIN_HZ,
    surfaceProbability: 0,
  };
}

// ============================================
// 決定的な擬似乱数（ensembleRulesと同じmulberry32）
// ============================================

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================
// 時刻の共鳴（案イ：同じ時間帯の記憶が浮かぶ）
// ============================================

type HourBand = 'morning' | 'noon' | 'evening' | 'night';

/** ensembleRulesの時間帯区分と同じ境界（朝5-10/昼10-16/夕16-21/夜21-5） */
function hourBand(hour: number): HourBand {
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'noon';
  if (hour >= 16 && hour < 21) return 'evening';
  return 'night';
}

/** ISO日時 → JSTの時 */
function jstHour(isoDate: string): number {
  const t = Date.parse(isoDate);
  if (Number.isNaN(t)) return 12; // 壊れた日時は昼として扱う（安全側の中立）
  return Math.floor(((t + 9 * 3600_000) % 86400_000) / 3600_000);
}

// ============================================
// 風化
// ============================================

/** 経過日数 → ゲイン倍率。半減期30日、上限0.5・下限0.15 */
export function weatheringGain(ageDays: number): number {
  const decayed = WEATHERING_GAIN_CEILING * Math.pow(0.5, ageDays / WEATHERING_HALF_LIFE_DAYS);
  return round3(Math.max(WEATHERING_GAIN_FLOOR, decayed));
}

/** 経過日数 → ローパスHz。老いた記憶ほどこもり、1.2kHzで止まる */
export function weatheringLowpassHz(ageDays: number): number {
  const decayed =
    LOWPASS_MIN_HZ +
    (LOWPASS_MAX_HZ - LOWPASS_MIN_HZ) * Math.pow(0.5, ageDays / WEATHERING_HALF_LIFE_DAYS);
  return Math.round(decayed);
}

// ============================================
// 章の計画（このモジュールの中心）
// ============================================

/**
 * 1章分の計画を立てる。
 *
 * @param pastGenerations 過去世代（現行世代は呼び出し側で除外して渡す）
 * @param now             現在時刻（風化と時刻の共鳴の基準）
 * @param chapterIndex    章の通し番号。乱数の種＝同じ番号なら同じ章
 */
export function buildChapterPlan(
  pastGenerations: GenerationSummary[],
  now: Date,
  chapterIndex: number,
): EchoPlan {
  if (pastGenerations.length === 0) return silentChapter();

  const rng = mulberry32(chapterIndex + 1);

  // 沈黙の章：候補があっても記憶は必ず戻るとは限らない
  if (rng() < SILENT_CHAPTER_PROBABILITY) return silentChapter();

  // --- 時刻の共鳴：同じ時間帯に採取された記憶を優先候補に ---
  const currentBand = hourBand(now.getHours());
  const resonant = pastGenerations.filter(function matchBand(g) {
    return hourBand(jstHour(g.createdAt)) === currentBand;
  });
  const pool = resonant.length > 0 ? resonant : pastGenerations;

  // 輪番＋決定的オフセット：長く聴いても同じ記憶ばかりにならない
  const offset = Math.floor(rng() * pool.length);
  const chosen = pool[(chapterIndex + offset) % pool.length];

  // --- 風化：経過時間が気配の濃さとこもりを決める ---
  const ageDays = Math.max(0, (now.getTime() - Date.parse(chosen.createdAt)) / 86400_000);

  // --- 滲む層：休める3層から2つを輪番で選ぶ ---
  const roleStart = Math.floor(rng() * ECHO_ROLES.length);
  const roles: StemRole[] = [
    ECHO_ROLES[roleStart % ECHO_ROLES.length],
    ECHO_ROLES[(roleStart + 1) % ECHO_ROLES.length],
  ];

  return {
    generationId: chosen.id,
    roles,
    gainMul: weatheringGain(ageDays),
    lowpassHz: weatheringLowpassHz(ageDays),
    surfaceProbability: SURFACE_PROBABILITY,
  };
}

/**
 * 呼吸周期ごとの滲出判定（純粋）。
 * 「現在が休んでいる層 × 章が選んだ層 × 確率」の交差だけが実際に現れる。
 *
 * 乱数は呼吸周期番号から決定的に導く（章と別系統の種）：
 * 同じ周期なら同じ判定＝intent変更時の再適用でも結果が揺れない。
 * 判定に使うロールはrestingでなくても乱数を消費する
 * ——列の安定性（restingの変化で他の層の運命が変わらない）のため。
 */
export function decideEchoSurfacing(
  plan: EchoPlan,
  restingRoles: readonly StemRole[],
  cycleIndex: number,
  /** 聴き手の「間」による確率倍率（ensembleRules.echoProbabilityMultiplier） */
  probabilityMul = 1,
): StemRole[] {
  if (!plan.generationId || plan.surfaceProbability <= 0) return [];
  const probability = Math.min(1, plan.surfaceProbability * probabilityMul);
  const rng = mulberry32(cycleIndex * 31 + 7);
  const surfaced: StemRole[] = [];
  for (const role of plan.roles) {
    const roll = rng();
    if (restingRoles.includes(role) && roll < probability) {
      surfaced.push(role);
    }
  }
  return surfaced;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
