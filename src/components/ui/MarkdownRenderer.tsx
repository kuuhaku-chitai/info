'use client';

/**
 * 空白地帯 - MarkdownRenderer
 *
 * Markdown表示の入口。`/--/` 区切りの有無を判定し、
 *  - 区切りがあれば SlideDeck（横スライド表示）
 *  - 無ければ MarkdownContent（従来の縦表示）
 * に振り分ける。実描画は MarkdownContent が担う。
 *
 * これにより、本コンポーネントを使う全箇所（固定ページ・投稿・プロジェクト・履歴等）が
 * 自動的にスライド分割へ対応する。区切りの無い既存コンテンツは挙動不変。
 */

import { splitSlides } from '@/lib/utils';
import { MarkdownContent } from './MarkdownContent';
import { SlideDeck } from './SlideDeck';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
    const slides = splitSlides(content);

    if (slides.length > 1) {
        return <SlideDeck slides={slides} className={className} />;
    }

    return <MarkdownContent content={content} className={className} />;
}
