'use client';

/**
 * 空白地帯 - music Mode トグル
 *
 * 音符ひとつのアイコンが、React Flowのズームコントロール（右下）の
 * すぐ上に静かに佇む。押すと演奏パネル（PerformancePanel）がそっと開き、
 * 「聴く」と、層の傾き・間・揺らぎのスライダーが現れる。
 * 再生中は既存のpulse-whisper（4秒周期）で微かに脈動する
 * ——カウントダウンと同じ、空白地帯の鼓動の速さ。
 *
 * かつては右上隅（文字「音」）に置いていたが、スマホでは同じ位置に
 * ハンバーガーメニュー（MobileMenu, fixed top-6 right-6）があり押せなかった。
 * 右下のグラフ操作の近くなら、操作系がひとところに集まり指も迷わない。
 *
 * アイコンはMaterial Icons由来の音符グリフをSVGパスとして直接埋め込む
 * （フォント・アイコンライブラリの追加はしない＝軽量化最優先ルール準拠）。
 */

import { useState } from 'react';
import { useEnsemble, type EnsembleStatus } from './useEnsemble';
import { PerformancePanel } from './PerformancePanel';
import { neutralIntent, type PerformanceIntent } from './ensembleRules';

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

export function MusicModeToggle() {
  const { status, toggle, setIntent, setVolume } = useEnsemble();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  /** 聴き手の音量（0-2、1が等倍）。パネルを閉じても保持される */
  const [volume, setVolumeState] = useState(2);
  // 演奏の傾きはここ（パネルの外）で保持する：
  // パネルを閉じて開き直してもスライダーの位置は消えない
  const [intent, setIntentState] = useState<PerformanceIntent>(neutralIntent);

  function handleTogglePanel(): void {
    setIsPanelOpen(function flip(prev) { return !prev; });
  }

  function handleClosePanel(): void {
    setIsPanelOpen(false);
  }

  function handleIntentChange(next: PerformanceIntent): void {
    setIntentState(next);
    setIntent(next);
  }

  /** リセット：スライダーを中立（中間位置）へ戻し、エンジンは空間の記憶のままに */
  function handleReset(): void {
    setIntentState(neutralIntent());
    setIntent(null);
  }

  /** 聴き手の音量（傾きとは独立。リセットでは変わらない） */
  function handleVolumeChange(next: number): void {
    setVolumeState(next);
    setVolume(next);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleTogglePanel}
        aria-pressed={isPanelOpen}
        aria-label="music Mode — 空間の記憶を聴く・演奏する"
        title={
          status === 'playing'
            ? '空間の記憶が鳴っている'
            : 'music Mode — 空間の記憶を聴く'
        }
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

      {isPanelOpen && (
        <>
          {/* 外側クリックで閉じる透明な幕（背景を暗くしない——空白を覆わない） */}
          <button
            type="button"
            aria-label="演奏パネルを閉じる"
            onClick={handleClosePanel}
            className="fixed inset-0 z-10 cursor-default bg-transparent"
          />
          <PerformancePanel
            status={status}
            intent={intent}
            volume={volume}
            onTogglePlay={toggle}
            onIntentChange={handleIntentChange}
            onVolumeChange={handleVolumeChange}
            onReset={handleReset}
          />
        </>
      )}
    </>
  );
}
