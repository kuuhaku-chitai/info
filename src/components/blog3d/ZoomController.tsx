'use client';

/**
 * ZoomController - ズームレベルコントローラー
 *
 * 3D空間のズームレベルを調整するUIコンポーネント。
 * 「微弱」なデザインを維持しつつ、操作性を確保。
 */

interface ZoomControllerProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoomChange: (zoom: number) => void;
}

export function ZoomController({
  zoom,
  minZoom,
  maxZoom,
  onZoomChange,
}: ZoomControllerProps) {
  // ズームレベルをパーセンテージで表示
  const zoomPercent = Math.round(((zoom - minZoom) / (maxZoom - minZoom)) * 100);

  function handleZoomIn() {
    const newZoom = Math.min(zoom + 1, maxZoom);
    onZoomChange(newZoom);
  }

  function handleZoomOut() {
    const newZoom = Math.max(zoom - 1, minZoom);
    onZoomChange(newZoom);
  }

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    onZoomChange(parseFloat(e.target.value));
  }

  return (
    <div
      className="flex flex-col items-center gap-2 p-3 bg-[var(--color-void)] border border-[var(--color-edge)] rounded-sm"
      style={{
        // 「未完の台形」風の微妙な歪み
        clipPath: 'polygon(2% 0%, 100% 1%, 98% 100%, 0% 99%)',
      }}
    >
      {/* ズームイン */}
      <button
        onClick={handleZoomIn}
        disabled={zoom >= maxZoom}
        className="w-6 h-6 flex items-center justify-center text-ghost hover:text-ink transition-colors disabled:opacity-30"
        aria-label="ズームイン"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="6" y1="2" x2="6" y2="10" />
          <line x1="2" y1="6" x2="10" y2="6" />
        </svg>
      </button>

      {/* スライダー（縦向き） */}
      <div className="relative h-20 flex items-center justify-center">
        <input
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.5}
          value={zoom}
          onChange={handleSliderChange}
          className="h-16 appearance-none bg-transparent cursor-pointer"
          style={{
            writingMode: 'vertical-lr',
            direction: 'rtl',
            width: '4px',
          }}
          aria-label="ズームレベル"
        />
        {/* カスタムスタイル用のトラック表示 */}
        <div
          className="absolute pointer-events-none w-[2px] h-16 bg-[var(--color-edge)]"
          style={{ left: '50%', transform: 'translateX(-50%)' }}
        >
          <div
            className="absolute bottom-0 w-full bg-[var(--color-ghost)]"
            style={{
              height: `${zoomPercent}%`,
              transition: 'height 150ms ease-out',
            }}
          />
        </div>
      </div>

      {/* ズームアウト */}
      <button
        onClick={handleZoomOut}
        disabled={zoom <= minZoom}
        className="w-6 h-6 flex items-center justify-center text-ghost hover:text-ink transition-colors disabled:opacity-30"
        aria-label="ズームアウト"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <line x1="2" y1="6" x2="10" y2="6" />
        </svg>
      </button>

      {/* ズームレベル表示 */}
      <span className="text-[9px] text-ghost tracking-wider">
        {zoom.toFixed(1)}
      </span>
    </div>
  );
}
