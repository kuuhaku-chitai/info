'use client';

/**
 * 空白地帯 - 自動採取スケジュール（朝・昼・晩 JST）
 *
 * 3つの時刻入力が静かに並ぶ。保存すると次の自動採取から反映される。
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveMusicSchedule } from '@/lib/music/musicActions';

export function ScheduleForm({
  morning,
  noon,
  evening,
}: {
  morning: string;
  noon: string;
  evening: string;
}) {
  const [values, setValues] = useState({ morning, noon, evening });
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty =
    values.morning !== morning || values.noon !== noon || values.evening !== evening;

  function handleChange(key: 'morning' | 'noon' | 'evening', value: string) {
    setValues(function merge(prev) {
      return { ...prev, [key]: value };
    });
    setMessage(null);
  }

  function handleSave() {
    startTransition(async function persist() {
      try {
        await saveMusicSchedule(values.morning, values.noon, values.evening);
        setMessage('保存した。');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存できなかった。');
      }
    });
  }

  const inputClass =
    'bg-transparent border border-edge rounded px-2 py-1 text-xs text-ink w-24 focus:border-ghost focus:outline-none';

  return (
    <div className={`flex items-center gap-4 flex-wrap ${isPending ? 'opacity-50' : ''}`}>
      <label className="flex items-center gap-2 text-xs text-ghost">
        朝
        <input
          type="time"
          value={values.morning}
          onChange={function onMorning(e) { handleChange('morning', e.target.value); }}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-ghost">
        昼
        <input
          type="time"
          value={values.noon}
          onChange={function onNoon(e) { handleChange('noon', e.target.value); }}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-ghost">
        晩
        <input
          type="time"
          value={values.evening}
          onChange={function onEvening(e) { handleChange('evening', e.target.value); }}
          className={inputClass}
        />
      </label>
      {dirty && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="text-xs text-ghost hover:text-ink border-b border-transparent hover:border-ink transition-colors"
        >
          保存
        </button>
      )}
      {message && <span className="text-[11px] text-ghost">{message}</span>}
    </div>
  );
}
