'use client';

/**
 * 空白地帯 - 演奏パネル（音符トグルから開く静かなポップオーバー）
 *
 * PromptDJ的な「スライダーで音楽をsteerする」体験を、空白地帯の語彙に翻訳する：
 * - 生成パラメータ（Temperature / Top K …）は晒さない。
 *   触れられるのは 層の傾き（律動・低音・旋律・空気）・間・揺らぎ だけ。
 * - 0.5が中立＝「空間の記憶のまま」。聴き手は上書きできず、傾けるだけ。
 * - 応答は4秒ランプ——楽器ではなく、空間がゆっくり応える。
 * - リセットで全スライダーが中立へ戻り、空間自身の声に返す。
 *
 * このコンポーネントは状態を持たない（制御されたコンポーネント）：
 * スライダーの位置は親（MusicModeToggle）が保持するため、
 * パネルを閉じて開き直しても演奏の傾きはそのまま残る。
 *
 * 見た目は管理画面と同じ精神：数字もメーターも誇示しない。
 * 細い1本の線と小さな点だけのスライダー（.void-slider）。
 */

import type { PerformanceIntent } from './ensembleRules';
import type { StemRole } from '@/types';
import type { EnsembleStatus } from './useEnsemble';

const LAYER_LABELS: ReadonlyArray<{ role: StemRole; label: string }> = [
  { role: 'rhythm', label: '律動' },
  { role: 'bass', label: '低音' },
  { role: 'melody', label: '旋律' },
  { role: 'atmosphere', label: '空気' },
];

/** 再生コントロールの説明（ホバー時にそっと差し出す。視覚上は何も足さない） */
function playTitle(status: EnsembleStatus): string {
  switch (status) {
    case 'playing':
      return '静める';
    case 'loading':
      return '手繰り寄せている…';
    case 'empty':
      return 'まだ音は採取されていない。それもまた空白';
    case 'error':
      return '届かなかった。また後で';
    default:
      return '聴く';
  }
}

interface PerformancePanelProps {
  status: EnsembleStatus;
  /** 現在の演奏の傾き（親が保持。パネルを閉じても消えない） */
  intent: PerformanceIntent;
  /** 聴き手の音量（0-2、1が等倍。親が保持） */
  volume: number;
  onTogglePlay: () => void;
  onIntentChange: (intent: PerformanceIntent) => void;
  onVolumeChange: (volume: number) => void;
  /** リセット：全スライダーを中立（中間位置）へ戻す */
  onReset: () => void;
}

export function PerformancePanel({
  status,
  intent,
  volume,
  onTogglePlay,
  onIntentChange,
  onVolumeChange,
  onReset,
}: PerformancePanelProps) {
  function handleLayerChange(role: StemRole, value: number): void {
    onIntentChange({ ...intent, layers: { ...intent.layers, [role]: value } });
  }

  function handleMaChange(value: number): void {
    onIntentChange({ ...intent, ma: value });
  }

  function handleYuragiChange(value: number): void {
    onIntentChange({ ...intent, yuragi: value });
  }

  const playDisabled = status === 'loading' || status === 'empty' || status === 'error';

  return (
    <div
      className="music-panel-corner z-20 w-56 p-4 space-y-4
                 bg-void border border-edge rounded fade-in-slow"
      role="dialog"
      aria-label="空間の記憶を演奏する"
    >
      {/* 層の傾き */}
      <div className="space-y-2">
        {LAYER_LABELS.map(({ role, label }) => (
          <label key={role} className="flex items-center gap-3">
            <span className="text-[10px] text-ghost tracking-[0.2em] w-8 shrink-0">
              {label}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={intent.layers[role]}
              onChange={function onLayer(e) {
                handleLayerChange(role, Number(e.target.value));
              }}
              className="void-slider"
              aria-label={`${label}の傾き`}
            />
          </label>
        ))}
      </div>

      {/* 間・揺らぎ */}
      <div className="flex flex-col space-y-2 pt-2 border-t border-edge/60">
        <label className="flex items-center gap-3">
          <span className="text-[10px] text-ghost tracking-[0.2em] w-8 shrink-0">間</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intent.ma}
            onChange={function onMa(e) { handleMaChange(Number(e.target.value)); }}
            className="void-slider"
            aria-label="間（音の負の空間）"
          />
        </label>
        <label className="flex items-center gap-3">
          <span className="text-[10px] text-ghost tracking-[0.2em] w-8 shrink-0">揺らぎ</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={intent.yuragi}
            onChange={function onYuragi(e) { handleYuragiChange(Number(e.target.value)); }}
            className="void-slider"
            aria-label="揺らぎ（音量の満ち引き）"
          />
        </label>
        {/* 音量：聴く環境の調整（演奏の傾きとは別物。0-2・1が等倍）。
            analyserの後段なのでビジュアルには影響しない */}
        <label className="flex items-center gap-3 pt-2 border-t border-edge/60">
          <span className="text-[10px] text-ghost tracking-[0.2em] w-8 shrink-0">音量</span>
          <input
            type="range"
            min={0}
            max={3}
            step={0.01}
            value={volume}
            onChange={function onVolume(e) { onVolumeChange(Number(e.target.value)); }}
            className="void-slider"
            aria-label="音量"
            title="聴き手の音量（傾きスライダーとは独立）"
          />
        </label>
        {/* リセット：スライダーを中立（中間位置）へ戻し、空間自身の声に返す */}
        <button
          type="button"
          onClick={onReset}
          title="スライダーを中立へ戻し、空間の記憶のままにする"
          className="text-[10px] items-center text-ghost tracking-[0.2em] hover:text-ink transition-colors"
        >
          リセット
        </button>
      </div>

      {/* 再生コントロール：スライダーの下、音符トグルと同じ円の佇まい */}
      <div className="flex flex-col items-center gap-3 pt-2 border-t border-edge/60">
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={playDisabled}
          aria-label={playTitle(status)}
          title={playTitle(status)}
          className={`w-8 h-8 flex items-center justify-center rounded-full border
            transition-[opacity,border-color] duration-700
            ${playDisabled
              ? 'text-ghost border-edge opacity-40 cursor-default'
              : status === 'playing'
                ? 'text-ink border-ink pulse-whisper cursor-pointer'
                : 'text-ghost border-edge opacity-70 hover:border-ghost hover:opacity-100 cursor-pointer'}`}
        >
          {status === 'playing' ? (
            /* Material Icons "stop" グリフ（Apache License 2.0） */
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M6 6h12v12H6z" />
            </svg>
          ) : (
            /* Material Icons "play_arrow" グリフ（Apache License 2.0） */
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
