'use client';

/**
 * 空白地帯 - 更新モード切替（Auto / Manual）
 *
 * 2つの言葉が並び、選ばれている方だけが濃い。スイッチの装飾はない。
 * 切り替えはD1の単一行を書き換え、全セッションに反映される。
 */

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setMusicMode } from '@/lib/music/musicActions';
import type { MusicUpdateMode } from '@/types';

export function ModeSwitch({ current }: { current: MusicUpdateMode }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSelect(mode: MusicUpdateMode) {
    if (mode === current || isPending) return;
    startTransition(async function applyMode() {
      await setMusicMode(mode);
      router.refresh();
    });
  }

  function modeClass(mode: MusicUpdateMode): string {
    return mode === current
      ? 'text-ink border-b border-ink'
      : 'text-ghost hover:text-ink';
  }

  return (
    <div className={`flex items-baseline gap-6 text-sm ${isPending ? 'opacity-50' : ''}`}>
      <button
        type="button"
        onClick={function selectManual() { handleSelect('manual'); }}
        className={`pb-0.5 transition-colors ${modeClass('manual')}`}
      >
        手動
      </button>
      <button
        type="button"
        onClick={function selectAuto() { handleSelect('auto'); }}
        className={`pb-0.5 transition-colors ${modeClass('auto')}`}
      >
        自動（朝・昼・晩）
      </button>
      <span className="text-[11px] text-ghost">
        {current === 'manual'
          ? '自動更新は完全に停止。Rebuildでのみ再構築される'
          : '1日最大3回、Historyの状態から自動で採取される'}
      </span>
    </div>
  );
}
