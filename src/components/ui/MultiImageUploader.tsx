'use client';

/**
 * 空白地帯 - MultiImageUploader
 *
 * 1つのバージョン（変更履歴）に複数枚の画像を添える。
 * 「変更前 → 変更中 → 変更後」のように、空間の変容の連なりを順序として保持する。
 *
 * - 画像はクライアントで圧縮 → /api/images（R2/MinIO）へアップロード → 確定URLを保持
 * - 並び順（sortOrder）は配列の順序で表現（上へ/下へ で調整）
 * - キャプションは各画像に静かに添える短いメモ
 * - 新規ライブラリは追加しない（軽量化最優先）
 */

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/utils';

export interface VersionImageItem {
  imageUrl: string;
  caption?: string;
}

interface MultiImageUploaderProps {
  /** 画像保存先のフォルダ分割キー（= バージョンID） */
  partitionId: string;
  /** 現在の画像配列（順序がそのまま sortOrder になる） */
  value: VersionImageItem[];
  /** 変更時のコールバック */
  onChange: (images: VersionImageItem[]) => void;
  label?: string;
  maxWidth?: number;
  quality?: number;
}

/** 画像をアスペクト比維持で圧縮する（ImageUploaderと同じ方針） */
function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      if (!ctx) {
        reject(new Error('Canvasコンテキストの取得に失敗しました'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('画像の圧縮に失敗しました'))),
        'image/jpeg',
        quality
      );
    };
    img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    img.src = URL.createObjectURL(file);
  });
}

/** URL末尾からR2/MinIO上のファイル名を取り出す */
function filenameFromUrl(url: string): string | null {
  const parts = url.split('/');
  return parts[parts.length - 1] || null;
}

export function MultiImageUploader({
  partitionId,
  value,
  onChange,
  label = '画像',
  maxWidth = 1600,
  quality = 0.82,
}: MultiImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (imageFiles.length === 0) {
        setError('画像ファイルを選択してください');
        return;
      }

      setError(null);
      setIsUploading(true);

      const uploaded: VersionImageItem[] = [];
      try {
        for (const file of imageFiles) {
          const blob = await compressImage(file, maxWidth, quality);
          const formData = new FormData();
          formData.append('file', blob, 'image.jpg');
          formData.append('postId', partitionId);

          const response = await fetch('/api/images', { method: 'POST', body: formData });
          const result = await response.json();
          if (!response.ok) {
            throw new Error(result.error || 'アップロードに失敗しました');
          }
          uploaded.push({ imageUrl: result.url, caption: '' });
        }
        onChange([...value, ...uploaded]);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setIsUploading(false);
      }
    },
    [partitionId, value, onChange, maxWidth, quality]
  );

  const removeAt = useCallback(
    async (index: number) => {
      const target = value[index];
      // R2/MinIO 上の実体も削除（同一フォルダ partitionId 配下）
      const filename = target ? filenameFromUrl(target.imageUrl) : null;
      if (filename) {
        try {
          await fetch(`/api/images?postId=${partitionId}&filename=${filename}`, {
            method: 'DELETE',
          });
        } catch {
          // 実体削除に失敗してもメタからは外す（孤児は後続の掃除に委ねる）
        }
      }
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange, partitionId]
  );

  const move = useCallback(
    (index: number, direction: -1 | 1) => {
      const next = index + direction;
      if (next < 0 || next >= value.length) return;
      const reordered = [...value];
      [reordered[index], reordered[next]] = [reordered[next], reordered[index]];
      onChange(reordered);
    },
    [value, onChange]
  );

  const setCaption = useCallback(
    (index: number, caption: string) => {
      onChange(value.map((item, i) => (i === index ? { ...item, caption } : item)));
    },
    [value, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      uploadFiles(e.dataTransfer.files);
    },
    [uploadFiles]
  );

  return (
    <div className="space-y-3">
      <label className="block text-xs text-ghost">{label}</label>

      {/* 既存画像の一覧（順序 = 変容の連なり） */}
      {value.length > 0 && (
        <ul className="space-y-3">
          {value.map((item, index) => (
            <li
              key={item.imageUrl}
              className="flex gap-4 items-start border border-edge rounded p-3"
            >
              {/* サムネイル */}
              <div className="relative w-28 h-20 flex-shrink-0 overflow-hidden rounded bg-void">
                <Image
                  src={getOptimizedImageUrl(item.imageUrl)}
                  alt={item.caption || `画像 ${index + 1}`}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              {/* キャプション + 並び替え */}
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={item.caption ?? ''}
                  onChange={(e) => setCaption(index, e.target.value)}
                  placeholder="この一枚に添えるメモ（変更前 / 変更後 など）"
                  className="w-full px-2 py-1 border border-edge rounded text-xs text-ink bg-void focus:outline-none focus:border-ghost"
                />
                <div className="flex items-center gap-2 text-[10px] text-ghost">
                  <span>{index + 1} / {value.length}</span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    className="px-2 py-0.5 border border-edge rounded hover:border-ghost transition-colors disabled:opacity-30"
                  >
                    ↑ 上へ
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === value.length - 1}
                    className="px-2 py-0.5 border border-edge rounded hover:border-ghost transition-colors disabled:opacity-30"
                  >
                    ↓ 下へ
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAt(index)}
                    className="px-2 py-0.5 ml-auto text-ghost hover:text-[var(--color-critical)] transition-colors"
                  >
                    削除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* アップロードエリア */}
      <div
        className={`
          relative border rounded transition-colors py-8 text-center
          ${isDragging ? 'border-ink bg-edge/50' : 'border-edge border-dashed'}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
      >
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          {isUploading ? 'アップロード中...' : '画像を追加（ドラッグ&ドロップ / 複数選択可）'}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
        className="hidden"
      />

      {error && <p className="text-xs text-[var(--color-critical)]">{error}</p>}
    </div>
  );
}
