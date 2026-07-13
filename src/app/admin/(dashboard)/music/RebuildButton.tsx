'use client';

/**
 * 空白地帯 - Rebuild Ensemble ボタン
 *
 * 生成の入口は /api/music/rebuild の一本（guard.tsを必ず通る）。
 * このボタンはそれを叩くだけ——上限判定もロックもサーバが守るので、
 * UIは結果の言葉を静かに返すことに徹する。
 *
 * 二段階クリック：一度目で「本当に？」と息を置く。モーダルは出さない。
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'idle' | 'confirm' | 'running';

export function RebuildButton({
  remaining,
  isGenerating,
}: {
  remaining: number;
  isGenerating: boolean;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  function handleClick() {
    if (phase === 'running') return;
    if (phase === 'idle') {
      setPhase('confirm');
      setMessage(null);
      return;
    }
    // confirm → 実行
    setPhase('running');
    void (async function rebuild() {
      try {
        const res = await fetch('/api/music/rebuild', { method: 'POST' });
        const result = (await res.json()) as { status: string; reason?: string };
        if (result.status === 'success') {
          setMessage('新しいアンサンブルが生まれた。');
        } else {
          setMessage(result.reason ?? '実行できなかった。');
        }
      } catch {
        setMessage('届かなかった。また後で。');
      }
      setPhase('idle');
      router.refresh();
    })();
  }

  const label =
    phase === 'running'
      ? '記憶を採取している…'
      : phase === 'confirm'
        ? '本当に？（Lyriaを1回呼ぶ）'
        : 'Rebuild Ensemble';

  const disabled = phase === 'running' || isGenerating || remaining === 0;

  return (
    <div className="flex items-baseline gap-4">
      <button
        type="button"
        onClick={handleClick}
        onBlur={function disarm() { if (phase === 'confirm') setPhase('idle'); }}
        disabled={disabled}
        className={`px-4 py-2 text-xs border rounded transition-colors
          ${disabled
            ? 'border-edge text-ghost opacity-50 cursor-default'
            : phase === 'confirm'
              ? 'border-ink text-ink'
              : 'border-edge text-ghost hover:border-ghost hover:text-ink'}`}
      >
        {label}
      </button>
      <span className="text-[11px] text-ghost">
        {isGenerating
          ? '別の採取が進行中'
          : remaining === 0
            ? '本日の上限に到達。日が変わるまで休む'
            : `残り ${remaining} 回`}
        {message && <span className="ml-3">{message}</span>}
      </span>
    </div>
  );
}
