'use client';

/**
 * 空白地帯 - MarkdownEditor
 *
 * 画像のドラッグ&ドロップに対応したMarkdownエディタ。
 * 画像をドロップするとアップロードして本文に挿入する。
 */

import { useState, useCallback, useRef } from 'react';

interface MarkdownEditorProps {
  /**
   * 投稿ID（画像保存先のディレクトリ名）
   */
  postId: string;
  /**
   * Markdownの値
   */
  value: string;
  /**
   * 値が変更されたときのコールバック
   */
  onChange: (value: string) => void;
  /**
   * プレースホルダー
   */
  placeholder?: string;
  /**
   * 行数
   */
  rows?: number;
  /**
   * 最大幅（圧縮時の基準）
   */
  maxWidth?: number;
  /**
   * 圧縮品質（0-1）
   */
  quality?: number;
}

export function MarkdownEditor({
  postId,
  value,
  onChange,
  placeholder = 'Markdownで記述...',
  rows = 15,
  maxWidth = 1200,
  quality = 0.8,
}: MarkdownEditorProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /**
   * テキストエリアのカーソル位置にテキストを挿入
   */
  function insertAtCursor(text: string) {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue =
        value.substring(0, start) + text + '\n' + value.substring(end);
      onChange(newValue);
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd =
          start + text.length + 1;
        textarea.focus();
      }, 0);
    } else {
      onChange(value + '\n' + text + '\n');
    }
  }

  /**
   * YouTube URLからembed iframeを生成して挿入
   */
  function handleInsertYouTube() {
    const url = prompt('YouTube URLを入力してください:');
    if (!url) return;

    // youtube.com/watch?v=ID or youtu.be/ID からIDを抽出
    let videoId: string | null = null;
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtube.com')) {
        videoId = parsed.searchParams.get('v');
      } else if (parsed.hostname === 'youtu.be') {
        videoId = parsed.pathname.slice(1);
      }
    } catch {
      // URL解析失敗
    }

    if (!videoId) {
      alert('YouTubeのURLを正しく入力してください。\n例: https://www.youtube.com/watch?v=...');
      return;
    }

    const iframe = `<iframe src="https://www.youtube.com/embed/${videoId}" title="YouTube" width="100%" height="450" frameborder="0" allowfullscreen></iframe>`;
    insertAtCursor(iframe);
  }

  /**
   * Google Maps埋め込みHTMLをそのまま挿入
   */
  function handleInsertGoogleMaps() {
    const html = prompt('Google Mapsの埋め込みHTML（iframeタグ）を貼り付けてください:');
    if (!html) return;

    // iframeタグを抽出
    const match = html.match(/<iframe[^>]*src="[^"]*google\.com\/maps[^"]*"[^>]*><\/iframe>/i);
    if (match) {
      insertAtCursor(match[0]);
    } else if (html.includes('<iframe') && html.includes('google.com/maps')) {
      insertAtCursor(html.trim());
    } else {
      alert('Google Mapsの埋め込みHTMLを正しく貼り付けてください。\nGoogle Mapsで「共有」→「地図を埋め込む」からHTMLをコピーしてください。');
    }
  }

  /**
   * 汎用embed: 任意のiframe HTMLを挿入
   */
  function handleInsertEmbed() {
    const html = prompt('埋め込みHTML（iframeタグ）を貼り付けてください:');
    if (!html) return;

    const match = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
    if (match) {
      insertAtCursor(match[0]);
    } else {
      alert('iframeタグを含むHTMLを貼り付けてください。');
    }
  }

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
                  reject(new Error('圧縮失敗'));
                }
              },
              'image/jpeg',
              quality
            );
          } else {
            reject(new Error('Canvas取得失敗'));
          }
        };

        img.onerror = () => reject(new Error('読み込み失敗'));
        img.src = URL.createObjectURL(file);
      });
    },
    [maxWidth, quality]
  );

  /**
   * 画像をアップロードしてMarkdownに挿入
   */
  const uploadAndInsertImage = useCallback(
    async (file: File) => {
      setIsUploading(true);

      try {
        // 圧縮
        const compressedBlob = await compressImage(file);

        // アップロード
        const formData = new FormData();
        formData.append('file', compressedBlob, 'image.jpg');
        formData.append('postId', postId);

        const response = await fetch('/api/images', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'アップロード失敗');
        }

        // Markdown画像記法を挿入
        const imageMarkdown = `![](${result.url})`;
        const textarea = textareaRef.current;

        if (textarea) {
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          const newValue =
            value.substring(0, start) +
            imageMarkdown +
            '\n' +
            value.substring(end);
          onChange(newValue);

          // カーソル位置を調整
          setTimeout(() => {
            textarea.selectionStart = textarea.selectionEnd =
              start + imageMarkdown.length + 1;
            textarea.focus();
          }, 0);
        } else {
          // テキストエリアがない場合は末尾に追加
          onChange(value + '\n' + imageMarkdown + '\n');
        }
      } catch (err) {
        console.error('Image upload error:', err);
        alert(err instanceof Error ? err.message : '画像のアップロードに失敗しました');
      } finally {
        setIsUploading(false);
      }
    },
    [postId, value, onChange, compressImage]
  );

  /**
   * ファイルを処理
   */
  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      Array.from(files).forEach((file) => {
        if (file.type.startsWith('image/')) {
          uploadAndInsertImage(file);
        }
      });
    },
    [uploadAndInsertImage]
  );

  /**
   * ドラッグイベント
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
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  /**
   * ペーストイベント（クリップボードからの画像貼り付け）
   */
  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith('image/')
      );

      if (imageItems.length > 0) {
        e.preventDefault();
        imageItems.forEach((item) => {
          const file = item.getAsFile();
          if (file) {
            uploadAndInsertImage(file);
          }
        });
      }
    },
    [uploadAndInsertImage]
  );

  return (
    <div className="relative">
      {/* 埋め込みツールバー */}
      <div className="flex gap-2 mb-1">
        <button
          type="button"
          onClick={handleInsertYouTube}
          className="px-2 py-0.5 text-[10px] text-ghost border border-edge rounded hover:text-ink hover:border-ghost transition-colors"
        >
          YouTube
        </button>
        <button
          type="button"
          onClick={handleInsertGoogleMaps}
          className="px-2 py-0.5 text-[10px] text-ghost border border-edge rounded hover:text-ink hover:border-ghost transition-colors"
        >
          Google Maps
        </button>
        <button
          type="button"
          onClick={handleInsertEmbed}
          className="px-2 py-0.5 text-[10px] text-ghost border border-edge rounded hover:text-ink hover:border-ghost transition-colors"
        >
          埋め込み
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onPaste={handlePaste}
        rows={rows}
        placeholder={placeholder}
        disabled={isUploading}
        className={`
          w-full px-3 py-2 border rounded text-sm text-ink bg-void font-mono
          focus:outline-none focus:border-ghost resize-y transition-colors
          ${isDragging ? 'border-ink bg-edge/30' : 'border-edge'}
          ${isUploading ? 'opacity-50' : ''}
        `}
      />

      {/* ドラッグオーバーレイ */}
      {isDragging && (
        <div className="absolute inset-0 border-2 border-dashed border-ink bg-void/90 rounded flex items-center justify-center pointer-events-none">
          <span className="text-sm text-ghost">画像をドロップして挿入</span>
        </div>
      )}

      {/* アップロード中オーバーレイ */}
      {isUploading && (
        <div className="absolute inset-0 bg-void/80 rounded flex items-center justify-center">
          <span className="text-sm text-ghost">画像をアップロード中...</span>
        </div>
      )}

      {/* ヘルプテキスト */}
      <p className="text-[10px] text-ghost mt-1 opacity-60">
        画像はドラッグ&ドロップ、またはCtrl+Vで貼り付け。YouTube・Google Maps等はツールバーから挿入できます
      </p>
    </div>
  );
}
