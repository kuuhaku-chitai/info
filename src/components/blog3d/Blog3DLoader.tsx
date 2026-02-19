'use client';

import { useProgress, Html } from '@react-three/drei';
import { useEffect, useState } from 'react';

/**
 * Blog3DLoader - 3Dシーンの読み込み進捗表示
 * 
 * 「空白地帯」のミニマルな美学を継承したローディング画面。
 * パーセント表記のみを静かに表示する。
 */
export function Blog3DLoader() {
    const { progress, active } = useProgress();
    const [visible, setVisible] = useState(true);
    const [opacity, setOpacity] = useState(1);

    useEffect(() => {
        if (!active && progress === 100) {
            // 読み込み完了後、少し待ってからフェードアウト開始
            const timer = setTimeout(() => {
                setOpacity(0);
                // フェードアウト完了後にDOMから削除
                setTimeout(() => setVisible(false), 1200);
            }, 400);
            return () => clearTimeout(timer);
        } else {
            setVisible(true);
            setOpacity(1);
        }
    }, [active, progress]);

    if (!visible) return null;

    return (
        <Html center zIndexRange={[100, 0]}>
            <div
                className="flex flex-col items-center justify-center pointer-events-none select-none transition-opacity duration-[var(--duration-subtle)] ease-[var(--easing-organic)]"
                style={{ opacity }}
            >
                {/* パーセント表示：数字がカウントアップする繊細な動き */}
                <div className="text-ink text-sm tracking-[0.4em] font-light mb-6 flex items-baseline gap-1">
                    <span className="tabular-nums">{Math.round(progress)}</span>
                    <span className="text-[10px] text-ghost">%</span>
                </div>

                {/* 進捗バー：極細の水平線 */}
                <div className="w-32 h-[1px] bg-[var(--color-edge)] relative overflow-hidden">
                    <div
                        className="absolute top-0 left-0 h-full bg-ink transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* 状態表示：空間の構築を暗示 */}
                <div className="mt-8 overflow-hidden">
                    <div className="text-[8px] text-ghost tracking-[0.5em] uppercase animate-pulse-whisper">
                        Initializing Void
                    </div>
                </div>
            </div>
        </Html>
    );
}
