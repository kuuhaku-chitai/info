/**
 * 空白地帯 - アンサンブル・ミックスルール（純粋関数・AI不使用）
 *
 * R2から届いた4つのstemを「どう重ねるか」を決める頭脳。
 * 約60秒の「呼吸周期」ごとに新しいミックス計画を立てることで、
 * 同じ4つの音源から常に新しいアンサンブルが生まれる——
 * 一度の採取（Lyria）が長く生き続けるための、ブラウザ側の進化装置。
 *
 * 原則：
 * - 常に1〜2 stemは休む。音にも負の空間を残す（欠落・静けさで休みは増える）
 * - atmosphereだけは決して休まない。空気の層が途切れなければ音楽は途切れない
 * - すべての値の変化はゆっくり（ランプ10秒以上）。急な変化は存在しない
 */

import type { MusicState, StemRole } from '@/types';

/** 呼吸周期（秒）。この間隔でミックス計画を立て直す */
export const BREATH_CYCLE_SEC = 60;

/** 1 stemの音量LFO（ゆらぎ）の設定 */
export interface StemLfo {
  /** 周期（秒）。20〜40秒＝波というより潮の満ち引き */
  periodSec: number;
  /** 深さ（±ゲイン）。微弱の上限 */
  depth: number;
}

/** 1 stemのミックス目標 */
export interface StemMixTarget {
  role: StemRole;
  /** 目標ゲイン（0-1）。restingの時は0へ沈む */
  gain: number;
  /** この周期は休むか */
  resting: boolean;
  lfo: StemLfo;
}

/** 1呼吸周期分のミックス計画 */
export interface MixPlan {
  targets: StemMixTarget[];
  /** 全体音量（0-1）。stillnessが深いほど下がる */
  masterGain: number;
  /**
   * 欠落の一瞬（短い無音）。absenceがある時だけ、周期内のどこかで
   * 1.2〜3秒だけ全体が息を呑む——消えた記録の気配
   */
  silenceBurst: { delaySec: number; durationSec: number } | null;
  /** ゲイン変更のランプ時間（秒）。急な変化を物理的に不可能にする */
  rampSec: number;
}

// ============================================
// 決定的な擬似乱数（mulberry32）
// 周期番号から同じ揺らぎ列を再現できる＝テスト可能な「偶然」
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
// 役割ごとの基礎値
// ============================================

/** 基礎ゲイン。atmosphereが主役、rhythmは最も控えめ（Engineの重み思想と同じ） */
const BASE_GAIN: Record<StemRole, number> = {
  atmosphere: 0.9,
  bass: 0.6,
  melody: 0.45,
  rhythm: 0.35,
};

/** LFO設定。役割ごとに周期をずらし、揺らぎの山が重ならないようにする */
const LFO: Record<StemRole, StemLfo> = {
  rhythm: { periodSec: 23, depth: 0.1 },
  bass: { periodSec: 31, depth: 0.08 },
  melody: { periodSec: 27, depth: 0.12 },
  atmosphere: { periodSec: 41, depth: 0.06 },
};

/**
 * 休むことができるstem。atmosphereは入れない——
 * 空気の層だけは絶やさないことで、シームレスな継続を保証する。
 */
const RESTABLE_ROLES: readonly StemRole[] = ['rhythm', 'melody', 'bass'];

// ============================================
// 時間帯の色
// ============================================

/**
 * 時間帯（JST時刻）による役割別の倍率。
 * 差は最大でも±30%——時間帯で「曲が変わる」のではなく「光が変わる」程度。
 */
function timeOfDayMultiplier(role: StemRole, hour: number): number {
  if (hour >= 5 && hour < 10) {
    // 朝：旋律がわずかに目覚める
    return role === 'melody' ? 1.2 : role === 'bass' ? 0.9 : 1.0;
  }
  if (hour >= 10 && hour < 16) {
    // 昼：均衡
    return 1.0;
  }
  if (hour >= 16 && hour < 21) {
    // 夕：低音が長い影を落とす
    return role === 'bass' ? 1.25 : role === 'rhythm' ? 0.9 : 1.0;
  }
  // 夜：すべてが沈み、空気だけが残る
  return role === 'atmosphere' ? 1.0 : 0.75;
}

/** 夜は全体もわずかに沈む */
function timeOfDayMasterMultiplier(hour: number): number {
  return hour >= 21 || hour < 5 ? 0.85 : 1.0;
}

// ============================================
// ミックス計画の生成（このモジュールの中心）
// ============================================

/**
 * 1呼吸周期分のミックス計画を立てる。
 *
 * @param state      manifestに載っていたMusicState（無ければ完全な既定値で静かに鳴る）
 * @param hour       現地の時刻（0-23）。時間帯の光として使う
 * @param cycleIndex 呼吸周期の通し番号。乱数の種＝同じ番号なら同じ計画（テスト可能）
 */
export function buildMixPlan(
  state: MusicState | null,
  hour: number,
  cycleIndex: number,
): MixPlan {
  const rng = mulberry32(cycleIndex + 1);
  const stillness = state?.stillness ?? 0.5;
  const absence = state?.absence ?? 0;
  const branchActivity = state?.branchActivity ?? 0;

  // --- 休むstemの選定：常に1つ、欠落や深い静けさの時は2つ ---
  // 輪番（cycleIndex）で回すことで、長く聴いても同じ組み合わせが続かない
  const restCount = absence > 0.3 || stillness > 0.6 ? 2 : 1;
  const restStart = Math.floor(rng() * RESTABLE_ROLES.length);
  const restingRoles = new Set<StemRole>();
  for (let i = 0; i < restCount; i++) {
    restingRoles.add(RESTABLE_ROLES[(restStart + i) % RESTABLE_ROLES.length]);
  }

  // --- 役割ごとの目標ゲイン ---
  const targets: StemMixTarget[] = (
    ['rhythm', 'bass', 'melody', 'atmosphere'] as StemRole[]
  ).map(function toTarget(role): StemMixTarget {
    const resting = restingRoles.has(role);
    // 分岐が活発なほどレイヤーがわずかに厚くなる（重なりの気配）
    const activityLift = 1 + 0.15 * branchActivity;
    const gain = resting
      ? 0
      : clamp01(BASE_GAIN[role] * timeOfDayMultiplier(role, hour) * activityLift);
    return { role, gain: round3(gain), resting, lfo: LFO[role] };
  });

  // --- 全体音量：静けさで沈む。無音にはしない（空間が在る限り音は残る） ---
  const masterGain = round3(
    0.5 * (1 - 0.35 * stillness) * timeOfDayMasterMultiplier(hour),
  );

  // --- 欠落の一瞬：absenceに比例した確率で、周期のどこかで息を呑む ---
  let silenceBurst: MixPlan['silenceBurst'] = null;
  if (absence > 0 && rng() < absence * 0.6) {
    silenceBurst = {
      delaySec: round3(5 + rng() * (BREATH_CYCLE_SEC - 15)),
      durationSec: round3(1.2 + rng() * 1.8),
    };
  }

  return {
    targets,
    masterGain,
    silenceBurst,
    // ランプは10〜16秒：変化は気づいた時にはもう終わっている速さで
    rampSec: round3(10 + rng() * 6),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
