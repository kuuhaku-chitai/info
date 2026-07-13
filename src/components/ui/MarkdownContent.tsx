'use client';

/**
 * 空白地帯 - MarkdownContent
 *
 * Markdownテキストを実際にレンダリングする中核コンポーネント。
 * react-markdown + remark-gfm（テーブル・打消し線等）
 *                + remark-math / rehype-katex（LaTeX数式）
 * 「空白地帯」のデザインコンセプトに合わせたスタイリング。
 *
 * スライド分割（/--/）の判定は MarkdownRenderer 側で行い、
 * ここは「1枚分のMarkdown」を描画することに専念する（SlideDeckからも再利用）。
 */

import { isValidElement, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import Image from 'next/image';
import type { Components } from 'react-markdown';
import { getOptimizedImageUrl } from '@/lib/utils';

// mermaidはd3/dagreを含む巨大ライブラリ。ssr:false でクライアント専用チャンクに分離し、
// サーバー(Worker)バンドルへ混入させない（3MiB制限超過を防ぐ）。
// 図は閲覧時のみ動的ロードされ、通常ページ・サーバーサイズには影響しない。
const Mermaid = dynamic(() => import('./Mermaid').then((m) => m.Mermaid), {
    ssr: false,
});

// iframe埋め込みを許可する信頼ドメイン
const TRUSTED_IFRAME_DOMAINS = [
    'www.youtube.com',
    'youtube.com',
    'www.youtube-nocookie.com',
    'www.google.com',
    'maps.google.com',
    'maps.google.co.jp',
    'player.vimeo.com',
    'open.spotify.com',
];

function isTrustedIframeSrc(src: string): boolean {
    try {
        const url = new URL(src);
        return TRUSTED_IFRAME_DOMAINS.some(domain => url.hostname === domain);
    } catch {
        return false;
    }
}

// React要素ツリーから生テキストを再帰的に抽出する。
// mermaidコードブロックの中身（複数行のソース）を取り出すために使用。
function extractText(node: ReactNode): string {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (isValidElement(node)) {
        return extractText((node.props as { children?: ReactNode }).children);
    }
    return '';
}

interface MarkdownContentProps {
    content: string;
    className?: string;
}

export function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
    // カスタムコンポーネント定義
    const components: Components = {
        // 見出し
        h1: ({ children }) => (
            <h2 className="text-lg font-light text-ink mt-12 mb-4 tracking-wide">
                {children}
            </h2>
        ),
        h2: ({ children }) => (
            <h3 className="text-base font-light text-ink mt-10 mb-3 tracking-wide">
                {children}
            </h3>
        ),
        h3: ({ children }) => (
            <h4 className="text-sm font-medium text-ink mt-8 mb-2 tracking-wide">
                {children}
            </h4>
        ),
        h4: ({ children }) => (
            <h5 className="text-sm font-medium text-ghost mt-6 mb-2">
                {children}
            </h5>
        ),

        // 段落
        p: ({ children }) => (
            <p className="text-sm text-ink leading-[2] mb-4 font-light">
                {children}
            </p>
        ),

        // 強調
        strong: ({ children }) => (
            <strong className="font-medium text-ink">{children}</strong>
        ),
        em: ({ children }) => (
            <em className="italic text-ghost">{children}</em>
        ),
        // GFM打消し線
        del: ({ children }) => (
            <del className="text-ghost line-through">{children}</del>
        ),

        // リンク
        a: ({ href, children }) => (
            <a
                href={href}
                className="text-ink underline underline-offset-2 hover:text-ghost transition-colors"
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            >
                {children}
            </a>
        ),

        // リスト
        ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-4 text-sm text-ink font-light pl-4">
                {children}
            </ul>
        ),
        ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-4 text-sm text-ink font-light pl-4">
                {children}
            </ol>
        ),
        li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
        ),

        // 引用
        blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-ghost pl-4 my-6 text-ghost italic">
                {children}
            </blockquote>
        ),

        // コード
        code: ({ className: codeClassName, children }) => {
            const isBlock = codeClassName?.includes('language-');
            if (isBlock) {
                return (
                    <code className="block bg-[#f5f5f5] p-4 rounded text-xs font-mono overflow-x-auto my-4">
                        {children}
                    </code>
                );
            }
            return (
                <code className="bg-[#f0f0f0] px-1.5 py-0.5 rounded text-xs font-mono text-ink">
                    {children}
                </code>
            );
        },
        pre: ({ children }) => {
            // react-markdownはコードブロックを <pre><code class="language-xxx"> でラップする。
            // language-mermaid の場合はコードボックスではなく図としてレンダリングする。
            const codeChild = Array.isArray(children) ? children[0] : children;
            if (isValidElement(codeChild)) {
                const codeProps = codeChild.props as {
                    className?: string;
                    children?: ReactNode;
                };
                if (codeProps.className?.includes('language-mermaid')) {
                    const chart = extractText(codeProps.children).trim();
                    return <Mermaid chart={chart} />;
                }
            }
            return (
                <pre className="bg-[#f5f5f5] p-4 rounded text-xs font-mono overflow-x-auto my-4">
                    {children}
                </pre>
            );
        },

        // 画像
        img: ({ src, alt }) => {
            if (!src || typeof src !== 'string') return null;

            const imageSrc = getOptimizedImageUrl(src);

            return (
                <span className="block my-8">
                    <Image
                        src={imageSrc}
                        alt={alt || ''}
                        width={800}
                        height={600}
                        className="w-full h-auto rounded"
                        unoptimized
                    />
                </span>
            );
        },

        // 水平線
        hr: () => (
            <hr className="border-t border-edge my-8" />
        ),

        // iframe埋め込み（YouTube, Google Maps等）
        // 信頼ドメインのみ許可し、それ以外は表示しない
        iframe: ({ src, title, width, height }) => {
            if (!src || typeof src !== 'string' || !isTrustedIframeSrc(src)) {
                return null;
            }
            return (
                <span className="block my-8">
                    <iframe
                        src={src}
                        title={title || '埋め込みコンテンツ'}
                        width={width || '100%'}
                        height={height || '450'}
                        className="w-full rounded border-0"
                        style={{ aspectRatio: '16 / 9' }}
                        sandbox="allow-scripts allow-same-origin allow-popups"
                        loading="lazy"
                        allowFullScreen
                    />
                </span>
            );
        },

        // セキュリティ: script/styleタグを無効化
        script: () => null,
        style: () => null,

        // テーブル（GFM）
        table: ({ children }) => (
            <div className="overflow-x-auto my-6">
                <table className="w-full text-sm border-collapse">
                    {children}
                </table>
            </div>
        ),
        thead: ({ children }) => (
            <thead className="border-b border-edge">{children}</thead>
        ),
        tbody: ({ children }) => (
            <tbody>{children}</tbody>
        ),
        tr: ({ children }) => (
            <tr className="border-b border-edge/50">{children}</tr>
        ),
        th: ({ children }) => (
            <th className="text-left py-2 px-3 font-medium text-ink">{children}</th>
        ),
        td: ({ children }) => (
            <td className="py-2 px-3 text-ink font-light">{children}</td>
        ),
    };

    return (
        <div className={`prose-void ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                components={components}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}
