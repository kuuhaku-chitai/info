'use client';

/**
 * 空白地帯 - Mermaid
 *
 * Markdown内の ```mermaid コードブロックを図としてレンダリングする。
 * mermaid本体は重量級（数百KB）なので dynamic import で遅延読込みし、
 * mermaid記法を含むページを開いたときだけロードする。
 * → 通常ページのバンドルサイズには影響せず「軽量化最優先」を維持。
 *
 * 「空白地帯」のコンセプトに合わせ、線は細く・色は控えめ（neutralテーマ）に。
 * 派手さを避け、図そのものも余白の中に静かに置かれる存在として描画する。
 */

import { useEffect, useRef, useState, useId } from 'react';

interface MermaidProps {
    chart: string;
}

export function Mermaid({ chart }: MermaidProps) {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    // useIdの「:」はDOM/CSSセレクタで無効なので除去してレンダーIDに使う
    const rawId = useId();
    const renderId = `mermaid-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    // chartの最新値を保持し、非同期完了時に古い描画で上書きしないようにする
    const latestChart = useRef(chart);
    latestChart.current = chart;

    useEffect(() => {
        let cancelled = false;
        const source = chart;

        async function renderDiagram() {
            try {
                const mermaid = (await import('mermaid')).default;
                mermaid.initialize({
                    startOnLoad: false,
                    // securityLevel: 'strict' でHTMLラベル・スクリプト埋め込みを禁止（XSS対策）
                    securityLevel: 'strict',
                    // 控えめで線の細いテーマ。空白地帯のトーンに合わせる
                    theme: 'neutral',
                    fontFamily: 'inherit',
                });

                // 構文チェック（不正な記法は描画前にここで弾く）
                await mermaid.parse(source);
                const { svg: rendered } = await mermaid.render(renderId, source);

                if (!cancelled && latestChart.current === source) {
                    setSvg(rendered);
                    setError(null);
                }
            } catch (e) {
                if (!cancelled && latestChart.current === source) {
                    setSvg('');
                    setError(e instanceof Error ? e.message : 'Mermaid render error');
                }
            }
        }

        renderDiagram();

        return () => {
            cancelled = true;
        };
    }, [chart, renderId]);

    // 描画失敗時は元のソースをコードとして表示（内容を失わない）
    if (error) {
        return (
            <pre className="bg-[#f5f5f5] p-4 rounded text-xs font-mono overflow-x-auto my-4 text-ghost">
                <code>{chart}</code>
            </pre>
        );
    }

    // 描画完了まではプレースホルダ（レイアウトの飛びを抑える静かな余白）
    if (!svg) {
        return <div className="my-8 min-h-[2rem]" aria-hidden="true" />;
    }

    return (
        <div
            className="my-8 flex justify-center overflow-x-auto [&_svg]:max-w-full [&_svg]:h-auto"
            role="img"
            dangerouslySetInnerHTML={{ __html: svg }}
        />
    );
}
