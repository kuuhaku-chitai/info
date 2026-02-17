'use client';

/**
 * 空白地帯 - 固定ページフォーム
 *
 * 固定ページの作成・編集に使用するフォーム。
 * 投稿フォームと異なり、カテゴリ・タグ・イベント日時は不要。
 * 代わりにURLパスと表示順序を設定する。
 */

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type Page } from '@/types';
import { createNewPage, updateExistingPage } from '@/lib/actions';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';

interface PageFormProps {
  page?: Page;
}

/** 予約済みパス（既存ルートとの競合を防ぐ） */
const RESERVED_PATHS = ['blog', 'schedule', 'projects', 'project', 'contact', 'post', 'admin', 'api'];

function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function PageForm({ page }: PageFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const pageId = useMemo(() => page?.id ?? generateTempId(), [page?.id]);

  const [title, setTitle] = useState(page?.title ?? '');
  const [path, setPath] = useState(page?.path ?? '');
  const [markdown, setMarkdown] = useState(page?.markdown ?? '');
  const [isPublished, setIsPublished] = useState(page?.isPublished ?? false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(
    page?.thumbnailUrl
  );
  const [sortOrder, setSortOrder] = useState(page?.sortOrder ?? 0);

  const isEditing = !!page;

  /** パスのバリデーション（英数字とハイフンのみ） */
  function handlePathChange(value: string) {
    // 先頭のスラッシュを除去し、英数字とハイフンのみ許可
    const cleaned = value.replace(/^\/+/, '').replace(/[^a-z0-9-]/g, '');
    setPath(cleaned);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    if (!path.trim()) {
      setError('パスを入力してください');
      return;
    }

    if (RESERVED_PATHS.includes(path)) {
      setError(`「${path}」は予約済みのパスです。別のパスを使用してください。`);
      return;
    }

    startTransition(async () => {
      try {
        const pageData = {
          title: title.trim(),
          path: path.trim(),
          markdown,
          isPublished,
          thumbnailUrl,
          sortOrder,
        };

        if (isEditing) {
          await updateExistingPage(page.id, pageData);
        } else {
          await createNewPage(pageData);
        }

        router.push('/pages');
      } catch (err) {
        setError('保存に失敗しました');
        console.error(err);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* エラー表示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* アイキャッチ画像 */}
      <ImageUploader
        postId={pageId}
        value={thumbnailUrl}
        onChange={setThumbnailUrl}
        label="アイキャッチ画像"
        aspectRatio={16 / 9}
        maxWidth={1200}
        quality={0.85}
      />

      {/* タイトル */}
      <div>
        <label htmlFor="title" className="block text-xs text-ghost mb-2">
          タイトル *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="ページのタイトル"
        />
      </div>

      {/* パス */}
      <div>
        <label htmlFor="path" className="block text-xs text-ghost mb-2">
          パス *
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-ghost">/</span>
          <input
            id="path"
            type="text"
            value={path}
            onChange={(e) => handlePathChange(e.target.value)}
            className="flex-1 px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
            placeholder="concept"
          />
        </div>
        <p className="text-[10px] text-ghost mt-1">
          英数字とハイフンのみ使用可能。例: concept, about, philosophy
        </p>
      </div>

      {/* 本文（Markdown） */}
      <div>
        <label htmlFor="markdown" className="block text-xs text-ghost mb-2">
          本文（Markdown）
        </label>
        <MarkdownEditor
          postId={pageId}
          value={markdown}
          onChange={setMarkdown}
          placeholder="Markdownで記述..."
          rows={15}
          maxWidth={1200}
          quality={0.8}
        />
      </div>

      {/* 表示順序 */}
      <div>
        <label htmlFor="sortOrder" className="block text-xs text-ghost mb-2">
          メニュー表示順序
        </label>
        <input
          id="sortOrder"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          className="w-32 px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          min={0}
        />
        <p className="text-[10px] text-ghost mt-1">
          小さい値ほどメニュー内で先に表示されます
        </p>
      </div>

      {/* 公開状態 */}
      <div className="flex items-center gap-2">
        <input
          id="isPublished"
          type="checkbox"
          checked={isPublished}
          onChange={(e) => setIsPublished(e.target.checked)}
          className="w-4 h-4 border border-edge rounded text-ink focus:ring-0"
        />
        <label htmlFor="isPublished" className="text-sm text-ink">
          公開する
        </label>
      </div>

      {/* 送信ボタン */}
      <div className="flex items-center gap-4 pt-4 border-t border-edge">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-ink text-void text-sm rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? '保存中...' : isEditing ? '更新' : '作成'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-4 py-2 border border-edge text-ghost text-sm rounded hover:border-ghost transition-colors"
        >
          キャンセル
        </button>
      </div>
    </form>
  );
}
