'use client';

/**
 * 空白地帯 - VersionForm（空間のコミット）
 *
 * 物理空間の「変更そのもの」を記録するフォーム。
 * 単なる施工記録ではなく、そこに宿る記憶(memory)のアーカイブであることを意識し、
 * memory 欄は他の項目より静かに大きく、余白を多めに扱う。
 *
 * 親バージョンを複数選択すると、それが「マージ（合流）」のエッジになる。
 */

import { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { type SpaceBranch, type VersionRecord, type VersionRecordDetail } from '@/types';
import { createNewVersionRecord, updateExistingVersionRecord } from '@/lib/actions';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { MultiImageUploader, type VersionImageItem } from '@/components/ui/MultiImageUploader';

interface VersionFormProps {
  /** 編集対象（新規時は未指定） */
  version?: VersionRecordDetail;
  /** 選択可能なブランチ一覧 */
  branches: SpaceBranch[];
  /** 親候補となる既存バージョン一覧 */
  allVersions: VersionRecord[];
  /** 新規時の初期ブランチ（一覧画面から渡す） */
  defaultBranchId?: string;
}

function generateVersionId(): string {
  return `ver-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function VersionForm({ version, branches, allVersions, defaultBranchId }: VersionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!version;

  // 画像フォルダ分割キー。新規は先にIDを確定させ、画像URLとレコードIDを揃える
  const versionId = useMemo(() => version?.id ?? generateVersionId(), [version?.id]);

  const [branchId, setBranchId] = useState(
    version?.branchId ?? defaultBranchId ?? branches[0]?.id ?? ''
  );
  const [title, setTitle] = useState(version?.title ?? '');
  const [content, setContent] = useState(version?.content ?? '');
  const [reason, setReason] = useState(version?.reason ?? '');
  const [memory, setMemory] = useState(version?.memory ?? '');
  const [locationNote, setLocationNote] = useState(version?.locationNote ?? '');
  const [author, setAuthor] = useState(version?.author ?? '');
  const [parentIds, setParentIds] = useState<string[]>(version?.parentIds ?? []);
  const [images, setImages] = useState<VersionImageItem[]>(
    version?.images.map((img) => ({ imageUrl: img.imageUrl, caption: img.caption })) ?? []
  );

  // 親候補（自分自身は除外）。ブランチ名を添えて表示
  const branchNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of branches) map.set(b.id, b.name);
    return map;
  }, [branches]);

  const parentCandidates = useMemo(
    () => allVersions.filter((v) => v.id !== versionId),
    [allVersions, versionId]
  );

  function toggleParent(id: string) {
    setParentIds((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!branchId) {
      setError('ブランチを選択してください');
      return;
    }
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          branchId,
          title: title.trim(),
          content,
          reason: reason.trim() || undefined,
          memory: memory.trim() || undefined,
          locationNote: locationNote.trim() || undefined,
          author: author.trim() || undefined,
          parentIds,
          images: images.map((img, i) => ({
            imageUrl: img.imageUrl,
            caption: img.caption?.trim() || undefined,
            sortOrder: i,
          })),
        };

        if (isEditing) {
          await updateExistingVersionRecord(version.id, payload);
        } else {
          await createNewVersionRecord({ id: versionId, ...payload });
        }

        router.push('/space');
        router.refresh();
      } catch (err) {
        // Server Action が投げたメッセージ（循環検知など）をそのまま表示
        setError(err instanceof Error ? err.message : '保存に失敗しました');
        console.error(err);
      }
    });
  };

  // ブランチが1つも無い場合は作成を促す
  if (branches.length === 0) {
    return (
      <p className="text-sm text-ghost py-8 text-center">
        先にブランチを作成してください。変更履歴はブランチに属します。
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* ブランチ */}
      <div>
        <label htmlFor="branchId" className="block text-xs text-ghost mb-2">
          ブランチ *
        </label>
        <select
          id="branchId"
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      {/* タイトル */}
      <div>
        <label htmlFor="title" className="block text-xs text-ghost mb-2">
          変更のタイトル *
        </label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="例: 北側の壁を取り払う"
        />
      </div>

      {/* 変更内容（Markdown） */}
      <div>
        <label htmlFor="content" className="block text-xs text-ghost mb-2">
          変更内容（Markdown）
        </label>
        <MarkdownEditor
          postId={versionId}
          value={content}
          onChange={setContent}
          placeholder="何を、どのように変えたか..."
          rows={10}
          maxWidth={1600}
          quality={0.82}
        />
      </div>

      {/* 変更理由 */}
      <div>
        <label htmlFor="reason" className="block text-xs text-ghost mb-2">
          変更理由
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost resize-y"
          placeholder="なぜ、この変更に至ったか"
        />
      </div>

      {/* 空間の記憶（memory）— コンセプトの核。静かに、大きく、余白を多めに */}
      <div className="py-6 my-2 border-y border-edge/60">
        <label htmlFor="memory" className="block text-sm font-light text-ink mb-1 tracking-wide">
          空間の記憶
        </label>
        <p className="text-[10px] text-ghost mb-4 leading-relaxed">
          ここで何が起きたか。数値や図面には残らない、その場の出来事や気配を書き留める。
        </p>
        <textarea
          id="memory"
          value={memory}
          onChange={(e) => setMemory(e.target.value)}
          rows={8}
          className="w-full px-4 py-4 border border-edge rounded text-sm text-ink bg-void leading-[2] font-light focus:outline-none focus:border-ghost resize-y"
          placeholder="　"
        />
      </div>

      {/* 位置メモ */}
      <div>
        <label htmlFor="locationNote" className="block text-xs text-ghost mb-2">
          位置メモ
        </label>
        <input
          id="locationNote"
          type="text"
          value={locationNote}
          onChange={(e) => setLocationNote(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="空間内のどこか（例: 1F 東側の窓際）"
        />
      </div>

      {/* 変更者 */}
      <div>
        <label htmlFor="author" className="block text-xs text-ghost mb-2">
          変更者
        </label>
        <input
          id="author"
          type="text"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
          placeholder="この変更に関わった人"
        />
      </div>

      {/* 親バージョン（複数選択 = マージ） */}
      <div>
        <label className="block text-xs text-ghost mb-2">
          派生元のバージョン（複数選択で合流＝マージ）
        </label>
        {parentCandidates.length === 0 ? (
          <p className="text-[11px] text-ghost py-2">
            まだ他のバージョンがありません。これが最初の変更（ルート）になります。
          </p>
        ) : (
          <div className="border border-edge rounded max-h-56 overflow-y-auto divide-y divide-edge/50">
            {parentCandidates.map((v) => (
              <label
                key={v.id}
                className="flex items-start gap-3 px-3 py-2 text-sm text-ink hover:bg-void cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={parentIds.includes(v.id)}
                  onChange={() => toggleParent(v.id)}
                  className="mt-1 w-4 h-4 border border-edge rounded focus:ring-0"
                />
                <span className="flex-1">
                  <span className="text-[10px] text-ghost mr-2">
                    [{branchNameById.get(v.branchId) ?? '—'}]
                  </span>
                  {v.title}
                </span>
              </label>
            ))}
          </div>
        )}
        {parentIds.length > 1 && (
          <p className="text-[10px] text-ghost mt-2">
            {parentIds.length}件の派生元を合流させます（マージ）。
          </p>
        )}
      </div>

      {/* 画像（複数） */}
      <MultiImageUploader
        partitionId={versionId}
        value={images}
        onChange={setImages}
        label="画像（変更前・変更中・変更後など）"
      />

      {/* 送信 */}
      <div className="flex items-center gap-4 pt-4 border-t border-edge">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-2 bg-ink text-void text-sm rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          {isPending ? '保存中...' : isEditing ? '更新' : '記録する'}
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
