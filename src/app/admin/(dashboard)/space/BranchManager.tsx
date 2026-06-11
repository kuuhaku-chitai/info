'use client';

/**
 * 空白地帯 - BranchManager
 *
 * ブランチ（履歴を束ねる単位）の作成・改名・削除をインラインで行う。
 * ブランチは軽量な存在なので、専用ページを設けず一覧上で静かに管理する。
 * 削除はブランチ配下の全バージョン・画像を連鎖削除するため、確認を必須とする。
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { type SpaceBranch } from '@/types';
import {
  createNewBranch,
  updateExistingBranch,
  deleteExistingBranch,
} from '@/lib/actions';

interface BranchManagerProps {
  branches: SpaceBranch[];
  /** 各ブランチの変更件数（削除時の警告に使用） */
  versionCounts: Record<string, number>;
}

export function BranchManager({ branches, versionCounts }: BranchManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleCreate = () => {
    if (!newName.trim()) {
      setError('ブランチ名を入力してください');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await createNewBranch({
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        });
        setNewName('');
        setNewDescription('');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ブランチの作成に失敗しました');
      }
    });
  };

  const beginEdit = (branch: SpaceBranch) => {
    setEditingId(branch.id);
    setEditName(branch.name);
    setEditDescription(branch.description ?? '');
  };

  const handleUpdate = (id: string) => {
    if (!editName.trim()) return;
    startTransition(async () => {
      try {
        await updateExistingBranch(id, {
          name: editName.trim(),
          description: editDescription.trim() || undefined,
        });
        setEditingId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ブランチの更新に失敗しました');
      }
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      try {
        await deleteExistingBranch(id);
        setConfirmDeleteId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'ブランチの削除に失敗しました');
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      {/* 新規ブランチ作成 */}
      <div className="border border-edge rounded p-4 space-y-3">
        <p className="text-xs text-ghost">新しいブランチ</p>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="ブランチ名（例: 2026春レイアウト）"
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
        />
        <input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="説明（任意）"
          className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending}
          className="px-4 py-2 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity disabled:opacity-50"
        >
          ブランチを作成
        </button>
      </div>

      {/* ブランチ一覧 */}
      {branches.length === 0 ? (
        <p className="text-sm text-ghost py-4 text-center">まだブランチがありません</p>
      ) : (
        <ul className="space-y-2">
          {branches.map((branch) => {
            const count = versionCounts[branch.id] ?? 0;
            const isEditing = editingId === branch.id;
            const isConfirming = confirmDeleteId === branch.id;

            return (
              <li key={branch.id} className="border border-edge rounded p-3">
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="説明（任意）"
                      className="w-full px-3 py-2 border border-edge rounded text-sm text-ink bg-void focus:outline-none focus:border-ghost"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleUpdate(branch.id)}
                        disabled={isPending}
                        className="px-3 py-1 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 border border-edge text-ghost text-xs rounded hover:border-ghost transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-ink">{branch.name}</p>
                      {branch.description && (
                        <p className="text-xs text-ghost mt-1">{branch.description}</p>
                      )}
                      <p className="text-[10px] text-ghost mt-1">{count}件の変更</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isConfirming ? (
                        <>
                          <span className="text-[10px] text-[var(--color-critical)]">
                            {count}件の変更も削除されます
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDelete(branch.id)}
                            disabled={isPending}
                            className="px-2 py-1 text-xs bg-[var(--color-critical)] text-void rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                          >
                            削除
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 text-xs border border-edge text-ghost rounded hover:border-ghost transition-colors"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(branch)}
                            className="px-3 py-1 text-xs text-ghost hover:text-ink transition-colors"
                          >
                            編集
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(branch.id)}
                            className="px-3 py-1 text-xs text-ghost hover:text-[var(--color-critical)] transition-colors"
                          >
                            削除
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
