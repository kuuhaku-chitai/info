'use client';

/**
 * 空白地帯 - ソーシャルリンクフォーム
 *
 * ソーシャルリンクの作成・編集に使用するフォーム。
 * アイコン画像のアップロードに対応。
 */

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type SocialLink } from '@/types';
import { createNewSocialLink, updateExistingSocialLink } from '@/lib/actions';
import { ImageUploader } from '@/components/ui/ImageUploader';

interface SocialLinkFormProps {
  link?: SocialLink;
}

function generateTempId(): string {
  return `social-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function SocialLinkForm({ link }: SocialLinkFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // アイコン画像保存用のID
  const linkId = useMemo(() => link?.id ?? generateTempId(), [link?.id]);

  // フォームの初期値
  const [title, setTitle] = useState(link?.title ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [iconUrl, setIconUrl] = useState<string | undefined>(link?.iconUrl);
  const [sortOrder, setSortOrder] = useState(link?.sortOrder ?? 0);

  const isEditing = !!link;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    if (!url.trim()) {
      setError('URLを入力してください');
      return;
    }

    if (!iconUrl) {
      setError('アイコン画像をアップロードしてください');
      return;
    }

    startTransition(async () => {
      try {
        const linkData = {
          title: title.trim(),
          url: url.trim(),
          iconUrl,
          sortOrder,
        };

        if (isEditing) {
          await updateExistingSocialLink(link.id, linkData);
        } else {
          await createNewSocialLink(linkData);
        }

        router.push('/social');
      } catch (err) {
        setError('保存に失敗しました');
        console.error(err);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md">
      {/* エラー表示 */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* アイコン画像 */}
      <ImageUploader
        postId={linkId}
        value={iconUrl}
        onChange={setIconUrl}
        label="アイコン画像 *"
        aspectRatio={1}
        maxWidth={256}
        quality={0.9}
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
          placeholder="Twitter, Instagram など"
        />
      </div>

      {/* URL */}
      <div>
        <label htmlFor="url" className="block text-xs text-ghost mb-2">
          URL *
        </label>
        <input
          id="url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="https://..."
        />
      </div>

      {/* 表示順序 */}
      <div>
        <label htmlFor="sortOrder" className="block text-xs text-ghost mb-2">
          表示順序（小さいほど先に表示）
        </label>
        <input
          id="sortOrder"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          className="w-32 px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
        />
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
