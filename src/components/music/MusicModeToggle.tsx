'use client';

/**
 * 空白地帯 - music Mode トグル
 *
 * 「音」の一文字だけが隅に佇む。再生中は既存のpulse-whisper（4秒周期）で
 * 微かに脈動する——カウントダウンと同じ、空白地帯の鼓動の速さ。
 *
 * プレイヤーUI（再生バー・音量・波形）は存在しない。
 * 聴くか、聴かないか。空間に対してできることはそれだけでいい。
 */

import { useEnsemble, type EnsembleStatus } from './useEnsemble';

/** 状態ごとの佇まい。すべて「文字の濃さ」だけで語る */
function statusClassName(status: EnsembleStatus): string {
  switch (status) {
    case 'playing':
      return 'text-ghost pulse-whisper';
    case 'loading':
      return 'text-ghost opacity-30';
    default:
      return 'text-ghost opacity-40 hover:opacity-70';
  }
}

/** ホバー時にそっと差し出す説明（視覚上は何も足さない） */
function statusTitle(status: EnsembleStatus): string {
  switch (status) {
    case 'playing':
      return '空間の記憶が鳴っている — もう一度押すと静かになる';
    case 'loading':
      return '記憶を手繰り寄せている…';
    case 'empty':
      return 'まだ音は採取されていない。それもまた空白';
    case 'error':
      return '音に届かなかった。また後で';
    default:
      return 'music Mode — 空間の記憶を聴く';
  }
}

export function MusicModeToggle() {
  const { status, toggle } = useEnsemble();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={status === 'playing'}
      aria-label="music Mode — 空間の記憶を聴く"
      title={statusTitle(status)}
      className={`
        hug-corner-tr z-10 text-xs tracking-[0.5em] font-light
        transition-opacity duration-700 cursor-pointer
        ${statusClassName(status)}
      `}
    >
      音
    </button>
  );
}
