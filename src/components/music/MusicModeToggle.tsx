'use client';

/**
 * 空白地帯 - music Mode トグル
 *
 * 音符ひとつのアイコンだけが、React Flowのズームコントロール（右下）の
 * すぐ上に静かに佇む。再生中は既存のpulse-whisper（4秒周期）で
 * 微かに脈動する——カウントダウンと同じ、空白地帯の鼓動の速さ。
 *
 * かつては右上隅（文字「音」）に置いていたが、スマホでは同じ位置に
 * ハンバーガーメニュー（MobileMenu, fixed top-6 right-6）があり押せなかった。
 * 右下のグラフ操作の近くなら、操作系がひとところに集まり指も迷わない。
 *
 * アイコンはMaterial Icons由来の音符グリフをSVGパスとして直接埋め込む
 * （フォント・アイコンライブラリの追加はしない＝軽量化最優先ルール準拠）。
 *
 * プレイヤーUI（再生バー・音量・波形）は存在しない。
 * 聴くか、聴かないか。空間に対してできることはそれだけでいい。
 */

import { useEnsemble, type EnsembleStatus } from './useEnsemble';

/** 状態ごとの佇まい。円枠の色とアイコンの濃さだけで語る */
function statusClassName(status: EnsembleStatus): string {
  switch (status) {
    case 'playing':
      return 'text-ghost border-ink pulse-whisper';
    case 'loading':
      return 'text-ghost border-edge opacity-40';
    default:
      return 'text-ghost border-edge opacity-60 hover:border-ghost hover:opacity-90';
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
        music-toggle-corner z-10 flex items-center justify-center
        rounded-full border bg-void
        transition-[opacity,border-color] duration-700 cursor-pointer
        ${statusClassName(status)}
      `}
    >
      {/* Material Icons "music_note" グリフ（Apache License 2.0） */}
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    </button>
  );
}
