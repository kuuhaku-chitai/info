'use client';

/**
 * 空白地帯 - 投稿フォーム
 *
 * 投稿の作成・編集に使用するフォーム。
 * アイキャッチ画像と本文への画像挿入に対応。
 *
 * コンセプト:
 * - シンプルで機能的なUI
 * - ドラッグ&ドロップで画像を簡単にアップロード
 * - 画像は自動的に圧縮される
 */

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type Post, type Project, type PostCategory } from '@/types';
import { createNewPost, updateExistingPost } from '@/lib/actions';
import { ImageUploader } from '@/components/ui/ImageUploader';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';

interface PostFormProps {
  /**
   * 編集時は既存の投稿データを渡す
   */
  post?: Post;
  /** プロジェクト一覧（紐づけ選択用） */
  projects?: Project[];
}

/**
 * 一時的なIDを生成（新規投稿用）
 * 画像アップロード時に使用
 */
function generateTempId(): string {
  return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function PostForm({ post, projects = [] }: PostFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 新規投稿の場合は一時的なIDを生成
  const postId = useMemo(() => post?.id ?? generateTempId(), [post?.id]);

  // フォームの初期値
  const [title, setTitle] = useState(post?.title ?? '');
  const [category, setCategory] = useState<PostCategory>(post?.category ?? 'note');
  const [markdown, setMarkdown] = useState(post?.markdown ?? '');
  const [tags, setTags] = useState(post?.tags.join(', ') ?? '');
  const [isPublished, setIsPublished] = useState(post?.isPublished ?? false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | undefined>(
    post?.thumbnailUrl
  );
  const [projectId, setProjectId] = useState<string>(post?.projectId ?? '');
  const [eventStartDate, setEventStartDate] = useState(
    post?.eventStartDate?.slice(0, 16) ?? ''
  );
  const [eventEndDate, setEventEndDate] = useState(
    post?.eventEndDate?.slice(0, 16) ?? ''
  );

  const isEditing = !!post;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    startTransition(async () => {
      try {
        const postData = {
          title: title.trim(),
          category,
          markdown,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
          isPublished,
          date: post?.date ?? new Date().toISOString(),
          thumbnailUrl,
          projectId: projectId || undefined,
          eventStartDate:
            category === 'event' && eventStartDate
              ? new Date(eventStartDate).toISOString()
              : undefined,
          eventEndDate:
            category === 'event' && eventEndDate
              ? new Date(eventEndDate).toISOString()
              : undefined,
        };

        if (isEditing) {
          await updateExistingPost(post.id, postData);
        } else {
          await createNewPost(postData);
        }

        router.push('/posts');
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
        postId={postId}
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
          placeholder="投稿のタイトル"
        />
      </div>

      {/* カテゴリ */}
      <div>
        <label htmlFor="category" className="block text-xs text-ghost mb-2">
          カテゴリ
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as PostCategory)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
        >
          <option value="note">メモ</option>
          <option value="article">記事</option>
          <option value="event">イベント</option>
          <option value="news">お知らせ</option>
        </select>
      </div>

      {/* イベント日時（イベントカテゴリの場合のみ） */}
      {category === 'event' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="eventStartDate"
              className="block text-xs text-ghost mb-2"
            >
              開始日時
            </label>
            <input
              id="eventStartDate"
              type="datetime-local"
              value={eventStartDate}
              onChange={(e) => setEventStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
            />
          </div>
          <div>
            <label
              htmlFor="eventEndDate"
              className="block text-xs text-ghost mb-2"
            >
              終了日時
            </label>
            <input
              id="eventEndDate"
              type="datetime-local"
              value={eventEndDate}
              onChange={(e) => setEventEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
            />
          </div>
        </div>
      )}

      {/* 本文（Markdown） */}
      <div>
        <label htmlFor="markdown" className="block text-xs text-ghost mb-2">
          本文（Markdown）
        </label>
        <MarkdownEditor
          postId={postId}
          value={markdown}
          onChange={setMarkdown}
          placeholder="Markdownで記述..."
          rows={15}
          maxWidth={1200}
          quality={0.8}
        />
      </div>

      {/* タグ */}
      <div>
        <label htmlFor="tags" className="block text-xs text-ghost mb-2">
          タグ（カンマ区切り）
        </label>
        <input
          id="tags"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="展示, 東京, 2025"
        />
      </div>

      {/* プロジェクト紐づけ */}
      {projects.length > 0 && (
        <div>
          <label htmlFor="projectId" className="block text-xs text-ghost mb-2">
            プロジェクト（紐づけると通常のブログ一覧には表示されません）
          </label>
          <select
            id="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          >
            <option value="">なし</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      )}

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
