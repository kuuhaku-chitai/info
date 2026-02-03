'use client';

/**
 * 空白地帯 - MarkdownRenderer
 *
 * Markdownテキストを適切にレンダリングするコンポーネント。
 * react-markdownを使用して完全なMarkdownサポートを提供。
 * 「空白地帯」のデザインコンセプトに合わせたスタイリング。
 */

import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import type { Components } from 'react-markdown';

interface MarkdownRendererProps {
    content: string;
    className?: string;
}

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
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
        code: ({ className, children }) => {
            const isBlock = className?.includes('language-');
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
        pre: ({ children }) => (
            <pre className="bg-[#f5f5f5] p-4 rounded text-xs font-mono overflow-x-auto my-4">
                {children}
            </pre>
        ),

        // 画像
        img: ({ src, alt }) => {
            if (!src || typeof src !== 'string') return null;
            return (
                <span className="block my-8">
                    <Image
                        src={src}
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

        // テーブル
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
            <ReactMarkdown components={components}>
                {content}
            </ReactMarkdown>
        </div>
    );
}
