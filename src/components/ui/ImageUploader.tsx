'use client';

/**
 * 空白地帯 - ImageUploader
 *
 * ドラッグ&ドロップに対応した画像アップローダー。
 * クライアントサイドで画像を圧縮してからアップロードする。
 *
 * コンセプト:
 * - シンプルで控えめなUI
 * - 画像がない場合は「no image」を表示
 * - 削除機能付き
 */

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';

interface ImageUploaderProps {
  /**
   * 投稿ID（画像保存先のディレクトリ名）
   */
  postId: string;
  /**
   * 現在の画像URL
   */
  value?: string;
  /**
   * 画像が変更されたときのコールバック
   */
  onChange: (url: string | undefined) => void;
  /**
   * ラベル
   */
  label?: string;
  /**
   * アスペクト比（デフォルト: 16/9）
   */
  aspectRatio?: number;
  /**
   * 最大幅（圧縮時の基準、デフォルト: 1200px）
   */
  maxWidth?: number;
  /**
   * 圧縮品質（0-1、デフォルト: 0.8）
   */
  quality?: number;
}

export function ImageUploader({
  postId,
  value,
  onChange,
  label = '画像',
  aspectRatio = 16 / 9,
  maxWidth = 1200,
  quality = 0.8,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * 画像を圧縮する
   */
  const compressImage = useCallback(
    async (file: File): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const img = document.createElement('img');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
          // アスペクト比を維持しながらリサイズ
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  resolve(blob);
                } else {
                  reject(new Error('画像の圧縮に失敗しました'));
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            reject(new Error('Canvasコンテキストの取得に失敗しました'));
          }
        };

        img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
        img.src = URL.createObjectURL(file);
      });
    },
    [maxWidth, quality]
  );

  /**
   * 画像をアップロードする
   */
  const uploadImage = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);

      try {
        // 画像を圧縮
        const compressedBlob = await compressImage(file);

        // FormDataを作成
        const formData = new FormData();
        formData.append('file', compressedBlob, `image.jpg`);
        formData.append('postId', postId);

        // アップロード
        const response = await fetch('/api/images', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'アップロードに失敗しました');
        }

        onChange(result.url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'エラーが発生しました');
      } finally {
        setIsUploading(false);
      }
    },
    [postId, compressImage, onChange]
  );

  /**
   * 画像を削除する
   */
  const deleteImage = useCallback(async () => {
    if (!value) return;

    setError(null);
    setIsUploading(true);

    try {
      // URLからファイル名を抽出
      // R2/MinIO: http://xxx/posts/{postId}/{filename}
      const urlParts = value.split('/');
      const filename = urlParts[urlParts.length - 1];
      if (!filename) throw new Error('ファイル名が取得できません');

      const response = await fetch(
        `/api/images?postId=${postId}&filename=${filename}`,
        { method: 'DELETE' }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || '削除に失敗しました');
      }

      onChange(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsUploading(false);
    }
  }, [value, postId, onChange]);

  /**
   * ファイル選択ハンドラ
   */
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const file = files[0];
      if (!file.type.startsWith('image/')) {
        setError('画像ファイルを選択してください');
        return;
      }

      uploadImage(file);
    },
    [uploadImage]
  );

  /**
   * ドラッグイベントハンドラ
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileSelect(e.dataTransfer.files);
    },
    [handleFileSelect]
  );

  return (
    <div className="space-y-2">
      {/* ラベル */}
      <label className="block text-xs text-ghost">{label}</label>

      {/* アップロードエリア */}
      <div
        className={`
          relative border rounded overflow-hidden transition-colors
          ${isDragging ? 'border-ink bg-edge/50' : 'border-edge'}
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        style={{ aspectRatio }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {value ? (
          // 画像がある場合
          <div className="relative w-full h-full group">
            <Image
              src={value}
              alt="アップロードされた画像"
              fill
              className="object-cover"
              unoptimized
            />
            {/* 削除ボタン（ホバー時に表示） */}
            <div className="absolute inset-0 bg-ink/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="px-3 py-1 bg-void text-ink text-xs rounded hover:bg-edge transition-colors"
              >
                変更
              </button>
              <button
                type="button"
                onClick={deleteImage}
                className="px-3 py-1 bg-[var(--color-critical)] text-void text-xs rounded hover:opacity-80 transition-opacity"
              >
                削除
              </button>
            </div>
          </div>
        ) : (
          // 画像がない場合
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center text-ghost hover:text-ink transition-colors"
          >
            <svg
              className="w-8 h-8 mb-2 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-xs">
              {isUploading ? 'アップロード中...' : 'no image'}
            </span>
            <span className="text-[10px] mt-1 opacity-50">
              ドラッグ&ドロップ または クリック
            </span>
          </button>
        )}

        {/* ローディングオーバーレイ */}
        {isUploading && (
          <div className="absolute inset-0 bg-void/80 flex items-center justify-center">
            <span className="text-xs text-ghost">処理中...</span>
          </div>
        )}
      </div>

      {/* 非表示のファイル入力 */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={(e) => handleFileSelect(e.target.files)}
        className="hidden"
      />

      {/* エラー表示 */}
      {error && (
        <p className="text-xs text-[var(--color-critical)]">{error}</p>
      )}
    </div>
  );
}
