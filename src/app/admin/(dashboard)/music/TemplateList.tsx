'use client';

/**
 * 空白地帯 - プロンプトテンプレート編集
 *
 * 4役割（律動・低音・旋律・空気）のテンプレートを1行ずつ静かに編集する。
 * 無効化しても削除はしない選択肢を残す（記録は消えない方が空白地帯らしい）。
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createMusicTemplate,
  updateMusicTemplate,
  deleteMusicTemplate,
} from '@/lib/music/musicActions';
import type { MusicPromptTemplate, StemRole } from '@/types';

const ROLE_LABELS: Record<StemRole, string> = {
  rhythm: '律動',
  bass: '低音',
  melody: '旋律',
  atmosphere: '空気',
};

const ROLES: StemRole[] = ['rhythm', 'bass', 'melody', 'atmosphere'];

// ============================================
// 1行分の編集
// ============================================

function TemplateRow({ tpl }: { tpl: MusicPromptTemplate }) {
  const [name, setName] = useState(tpl.name);
  const [template, setTemplate] = useState(tpl.template);
  const [isActive, setIsActive] = useState(tpl.isActive);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const dirty =
    name !== tpl.name || template !== tpl.template || isActive !== tpl.isActive;

  function handleSave() {
    startTransition(async function persist() {
      try {
        await updateMusicTemplate(tpl.id, {
          name,
          template,
          isActive,
          sortOrder: tpl.sortOrder,
        });
        setMessage('保存した。');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '保存できなかった。');
      }
    });
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    startTransition(async function remove() {
      try {
        await deleteMusicTemplate(tpl.id);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '消せなかった。');
        setConfirmingDelete(false);
      }
    });
  }

  return (
    <div
      className={`p-3 border border-edge rounded space-y-2 ${isPending ? 'opacity-50' : ''} ${!isActive ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-ghost tracking-[0.2em] w-8">
          {ROLE_LABELS[tpl.stemRole]}
        </span>
        <input
          value={name}
          onChange={function onName(e) { setName(e.target.value); setMessage(null); }}
          className="bg-transparent text-xs text-ink border-b border-transparent focus:border-edge focus:outline-none flex-1"
        />
        <label className="flex items-center gap-1.5 text-[11px] text-ghost cursor-pointer">
          <input
            type="checkbox"
            checked={isActive}
            onChange={function onActive(e) { setIsActive(e.target.checked); setMessage(null); }}
            className="accent-[var(--color-ghost)]"
          />
          有効
        </label>
        <button
          type="button"
          onClick={handleDelete}
          onBlur={function disarm() { setConfirmingDelete(false); }}
          className={`text-[11px] transition-colors ${confirmingDelete ? 'text-ink' : 'text-ghost hover:text-ink'}`}
        >
          {confirmingDelete ? '本当に消す？' : '削除'}
        </button>
      </div>
      <textarea
        value={template}
        onChange={function onTemplate(e) { setTemplate(e.target.value); setMessage(null); }}
        rows={2}
        maxLength={300}
        className="w-full bg-transparent text-xs text-ghost focus:text-ink border border-transparent focus:border-edge rounded px-1 py-0.5 focus:outline-none resize-none font-mono"
      />
      <div className="flex items-center gap-3 min-h-4">
        {dirty && (
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="text-[11px] text-ghost hover:text-ink border-b border-transparent hover:border-ink transition-colors"
          >
            保存
          </button>
        )}
        {message && <span className="text-[11px] text-ghost">{message}</span>}
      </div>
    </div>
  );
}

// ============================================
// 新規追加（普段は一行のリンクとして眠っている）
// ============================================

function NewTemplateForm({ nextSortOrder }: { nextSortOrder: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<StemRole>('atmosphere');
  const [template, setTemplate] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleCreate() {
    startTransition(async function persist() {
      try {
        await createMusicTemplate({ name, stemRole: role, template, sortOrder: nextSortOrder });
        setOpen(false);
        setName('');
        setTemplate('');
        setMessage(null);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '追加できなかった。');
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={function reveal() { setOpen(true); }}
        className="text-[11px] text-ghost hover:text-ink transition-colors"
      >
        ＋ 新しいテンプレート
      </button>
    );
  }

  return (
    <div className={`p-3 border border-edge rounded space-y-2 ${isPending ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <select
          value={role}
          onChange={function onRole(e) { setRole(e.target.value as StemRole); }}
          className="bg-transparent text-xs text-ghost border border-edge rounded px-1 py-0.5 focus:outline-none"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <input
          value={name}
          onChange={function onName(e) { setName(e.target.value); }}
          placeholder="名前"
          className="bg-transparent text-xs text-ink border-b border-edge focus:outline-none flex-1 placeholder:text-ghost"
        />
      </div>
      <textarea
        value={template}
        onChange={function onTemplate(e) { setTemplate(e.target.value); }}
        rows={2}
        maxLength={300}
        placeholder="sparse organic …（{keywords} {density} {trend} が使える）"
        className="w-full bg-transparent text-xs text-ink border border-edge rounded px-1 py-0.5 focus:outline-none resize-none font-mono placeholder:text-ghost"
      />
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="text-[11px] text-ghost hover:text-ink border-b border-transparent hover:border-ink transition-colors"
        >
          追加
        </button>
        <button
          type="button"
          onClick={function conceal() { setOpen(false); setMessage(null); }}
          className="text-[11px] text-ghost hover:text-ink transition-colors"
        >
          やめる
        </button>
        {message && <span className="text-[11px] text-ghost">{message}</span>}
      </div>
    </div>
  );
}

// ============================================
// 一覧
// ============================================

export function TemplateList({ templates }: { templates: MusicPromptTemplate[] }) {
  const nextSortOrder =
    templates.reduce(function maxOrder(max, t) { return Math.max(max, t.sortOrder); }, -1) + 1;

  return (
    <div className="space-y-2">
      {templates.map((tpl) => (
        <TemplateRow key={tpl.id} tpl={tpl} />
      ))}
      <NewTemplateForm nextSortOrder={nextSortOrder} />
    </div>
  );
}
