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
// 演奏の意図（Performance Intent）
// ============================================

/**
 * 聴き手が空間の音に与える「傾き」。
 *
 * 参照したPromptDJ的なUIの思想（スライダーで音楽をsteerする）を
 * 空白地帯の語彙に翻訳したもの：
 * - Temperature / Top K のような生成パラメータは晒さない。
 *   聴き手が触れるのは「層の傾き」「間」「揺らぎ」——空間の言葉だけ。
 * - すべて0-1、0.5が中立＝「空間の記憶のまま」。
 *   聴き手はミックスを上書きするのではなく、傾けることしかできない。
 *   絶対上限（master 0.5）はどう操作しても超えられない——
 *   演奏しても空白は殺せない、という設計上の約束。
 */
export interface PerformanceIntent {
  /** 各層の傾き（0=沈黙へ、0.5=記憶のまま、1=前へ） */
  layers: Record<StemRole, number>;
  /** 間（ま）：音の負の空間。高いほど休む層が増え、全体が沈む */
  ma: number;
  /** 揺らぎ：音量LFOの深さ。高いほど潮の満ち引きが大きくなる */
  yuragi: number;
}

/** 中立の意図＝空間の記憶のまま（新規オブジェクトを返す：呼び出し側で安全に変更可能） */
export function neutralIntent(): PerformanceIntent {
  return {
    layers: { rhythm: 0.5, bass: 0.5, melody: 0.5, atmosphere: 0.5 },
    ma: 0.5,
    yuragi: 0.5,
  };
}

/** 層スライダー(0-1) → ゲイン倍率(0-2)。0.5で等倍 */
function layerMultiplier(value: number): number {
  return value * 2;
}

/** 間(0-1) → master倍率。0.5で等倍。深い間は全体を沈める */
function maMasterMultiplier(ma: number): number {
  return 1 - 0.6 * (ma - 0.5);
}

/** 間(0-1) → 休む層の増減。端に振った時だけ±1 */
function maRestDelta(ma: number): number {
  if (ma >= 0.75) return 1;
  if (ma <= 0.25) return -1;
  return 0;
}

/** 揺らぎ(0-1) → LFO深さ倍率(0.4-1.6)。0.5で等倍。ゼロにはしない（完全な静止は嘘になる） */
function yuragiMultiplier(yuragi: number): number {
  return 0.4 + 1.2 * yuragi;
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
 * @param intent     聴き手の演奏意図。nullなら空間の記憶のまま
 */
export function buildMixPlan(
  state: MusicState | null,
  hour: number,
  cycleIndex: number,
  intent: PerformanceIntent | null = null,
): MixPlan {
  const rng = mulberry32(cycleIndex + 1);
  const stillness = state?.stillness ?? 0.5;
  const absence = state?.absence ?? 0;
  const branchActivity = state?.branchActivity ?? 0;

  // --- 休むstemの選定：常に1つ、欠落や深い静けさの時は2つ ---
  // 輪番（cycleIndex）で回すことで、長く聴いても同じ組み合わせが続かない。
  // 聴き手の「間」で±1するが、下限は1＝音の負の空間は必ず残る
  // （演奏しても「常に1〜2 stemは休む」原則は破れない）
  const baseRestCount = absence > 0.3 || stillness > 0.6 ? 2 : 1;
  const restCount = Math.min(
    RESTABLE_ROLES.length,
    Math.max(1, baseRestCount + (intent ? maRestDelta(intent.ma) : 0)),
  );
  const restStart = Math.floor(rng() * RESTABLE_ROLES.length);
  const restingRoles = new Set<StemRole>();
  for (let i = 0; i < restCount; i++) {
    restingRoles.add(RESTABLE_ROLES[(restStart + i) % RESTABLE_ROLES.length]);
  }

  // --- 役割ごとの目標ゲイン ---
  const yuragiMul = intent ? yuragiMultiplier(intent.yuragi) : 1;
  const targets: StemMixTarget[] = (
    ['rhythm', 'bass', 'melody', 'atmosphere'] as StemRole[]
  ).map(function toTarget(role): StemMixTarget {
    const resting = restingRoles.has(role);
    // 分岐が活発なほどレイヤーがわずかに厚くなる（重なりの気配）
    const activityLift = 1 + 0.15 * branchActivity;
    const layerMul = intent ? layerMultiplier(intent.layers[role]) : 1;
    const gain = resting
      ? 0
      : clamp01(BASE_GAIN[role] * timeOfDayMultiplier(role, hour) * activityLift * layerMul);
    const lfo: StemLfo = {
      periodSec: LFO[role].periodSec,
      depth: round3(LFO[role].depth * yuragiMul),
    };
    return { role, gain: round3(gain), resting, lfo };
  });

  // --- 全体音量：静けさで沈む。無音にはしない（空間が在る限り音は残る） ---
  // 強調項（Step 4）：空間が活発（trend×density）な時だけ明確に持ち上がる。
  // 聴き手の「間」で傾き、どの組み合わせでも絶対上限0.5は超えられない（空白は殺せない）
  const maMul = intent ? maMasterMultiplier(intent.ma) : 1;
  const density = state?.density ?? 0.3;
  const trend = state?.trend ?? 0;
  const emphasis = 1 + 0.25 * trend * density;
  const masterGain = round3(
    Math.min(
      0.5,
      0.5 * (1 - 0.35 * stillness) * timeOfDayMasterMultiplier(hour) * maMul * emphasis,
    ),
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

/**
 * 記憶（echo）が滲み出る時の目標ゲイン。
 * 現在の同役割の基礎ゲイン × 風化倍率 × 聴き手の層の傾き × ブースト。
 * 風化倍率は最大0.5なので、記憶は通常は現在の半分より前に出られない。
 * boost（大変容の出来事・×1.5・1呼吸周期のみ）が乗っても実効は最大0.75倍
 * ——出来事の間でさえ、記憶が現在の基礎値を超えることはない。
 */
export function echoSurfaceGain(
  role: StemRole,
  weatheringGainMul: number,
  intent: PerformanceIntent | null,
  boost = 1,
): number {
  const layerMul = intent ? layerMultiplier(intent.layers[role]) : 1;
  // ブースト込みでも風化倍率の実効は1未満に留める（現在の基礎値が常に天井）
  const effectiveWeathering = Math.min(1, weatheringGainMul * boost);
  return round3(clamp01(BASE_GAIN[role] * effectiveWeathering * layerMul));
}

/**
 * 全体lowpassのカットオフ（Hz）。
 * 普段は20kHz＝完全に素通し。stillness（静けさ）とabsence（欠落）が深いほど
 * 音がこもる——遠い部屋から聞こえる記憶のように。下限3kHz。
 * 対数補間：耳の感覚に沿って滑らかに沈む。
 */
export function masterLowpassHz(state: MusicState | null): number {
  const stillness = state?.stillness ?? 0.5;
  const absence = state?.absence ?? 0;
  const depth = clamp01(0.7 * stillness + 0.5 * absence);
  // 20000 × (3000/20000)^depth : depth 0→20000Hz, 1→3000Hz
  return Math.round(20000 * Math.pow(3000 / 20000, depth));
}

/**
 * 大きなHistory変容の判定（filter sweep＋echo boostのトリガー）。
 * 前回採取時とのtrend/absenceの変化量の合計が閾値を超えた時だけ「出来事」になる。
 * 初回（prevなし）は変容ではない——比較する記憶が無ければ、驚きも無い。
 */
export function isMajorTransformation(
  previous: MusicState | null,
  next: MusicState | null,
): boolean {
  if (!previous || !next) return false;
  const delta =
    Math.abs(next.trend - previous.trend) + Math.abs(next.absence - previous.absence);
  return delta >= 0.4;
}

/**
 * 「間」→ 記憶の滲出確率への倍率。
 * 間はすべての音に対する負の空間——深めれば記憶も浮かびにくくなり、
 * 浅めればわずかに浮かびやすくなる（0.5で等倍、上限は呼び出し側でclamp）。
 */
export function echoProbabilityMultiplier(intent: PerformanceIntent | null): number {
  if (!intent) return 1;
  return round3(Math.max(0, 1 - 0.8 * (intent.ma - 0.5)));
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
