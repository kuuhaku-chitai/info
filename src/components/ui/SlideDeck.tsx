'use client';

/**
 * 空白地帯 - SlideDeck
 *
 * マークダウンを `/--/` 区切りで分割し、縦長ではなく「横に移る」体験で見せる。
 * コンセプト寄与:
 *  - 一度に見えるのは1枚だけ。残りは余白の向こうに"未だ生成されていない"状態として隠れている。
 *  - 遷移は微弱（24pxの横滑り+フェード）で、断ち切る感覚ではなく"滲み変わる"感覚にする。
 *  - 矢印・ドットはghost色で気配程度に留め、80%の負の空間を侵さない。
 */

import { useState, useCallback, useEffect } from 'react';
import {
    AnimatePresence,
    motion,
    useReducedMotion,
    type PanInfo,
} from 'framer-motion';
import { MarkdownContent } from './MarkdownContent';

// スワイプ確定のしきい値。"払う"程度の弱い動きでも移れるよう、距離か速度のどちらかで判定する。
// 微弱なコンセプトに合わせ、誤操作しない範囲でやや軽めに設定。
const SWIPE_DISTANCE = 60; // px
const SWIPE_VELOCITY = 300; // px/s

interface SlideDeckProps {
    slides: string[];
    className?: string;
}

// 横滑り+フェードの遷移定義。direction(>0:次へ / <0:前へ)で滑る向きを変える。
const variants = {
    enter: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? 24 : -24,
    }),
    center: {
        opacity: 1,
        x: 0,
    },
    exit: (direction: number) => ({
        opacity: 0,
        x: direction > 0 ? -24 : 24,
    }),
};

// easing-dew 相当。微弱でゆっくり滲むような曲線。
const transition = { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const };

export function SlideDeck({ slides, className }: SlideDeckProps) {
    const total = slides.length;
    // [現在index, 進行方向] を1つのstateで管理し、AnimatePresenceのcustomへ渡す。
    const [[index, direction], setState] = useState<[number, number]>([0, 0]);
    const reduceMotion = useReducedMotion();

    const goTo = useCallback(
        (next: number, dir: number) => {
            setState(([current]) => {
                if (next < 0 || next >= total || next === current) {
                    return [current, dir];
                }
                return [next, dir];
            });
        },
        [total]
    );

    const goPrev = useCallback(() => {
        setState(([current]) => (current > 0 ? [current - 1, -1] : [current, -1]));
    }, []);

    const goNext = useCallback(() => {
        setState(([current]) =>
            current < total - 1 ? [current + 1, 1] : [current, 1]
        );
    }, [total]);

    // キーボード ←→ でのスライド移動
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'ArrowLeft') goPrev();
            else if (e.key === 'ArrowRight') goNext();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [goPrev, goNext]);

    // スワイプ確定: 左へ払えば次、右へ払えば前。距離・速度どちらかがしきい値を超えたら移動。
    const handleDragEnd = useCallback(
        (_event: unknown, info: PanInfo) => {
            const { offset, velocity } = info;
            const swipedLeft =
                offset.x < -SWIPE_DISTANCE || velocity.x < -SWIPE_VELOCITY;
            const swipedRight =
                offset.x > SWIPE_DISTANCE || velocity.x > SWIPE_VELOCITY;
            if (swipedLeft) goNext();
            else if (swipedRight) goPrev();
        },
        [goNext, goPrev]
    );

    const isFirst = index === 0;
    const isLast = index === total - 1;

    return (
        <div className="relative">
            {/* 番号: 気配程度に。01 / 05 */}
            <div className="mb-10 text-ghost text-xs tracking-[0.4em] font-light tabular-nums">
                {String(index + 1).padStart(2, '0')}
                <span className="opacity-50"> / {String(total).padStart(2, '0')}</span>
            </div>

            {/* スライド本体: 1枚だけ表示。最小高で余白を確保し、断片感を出す。
                touch-pan-y で縦スクロールは残しつつ、横ドラッグでスライド移動。 */}
            <div className="relative min-h-[55vh] touch-pan-y">
                <AnimatePresence mode="wait" custom={direction} initial={false}>
                    <motion.div
                        key={index}
                        custom={direction}
                        variants={reduceMotion ? undefined : variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        drag="x"
                        dragSnapToOrigin
                        dragConstraints={{ left: 0, right: 0 }}
                        dragElastic={0.18}
                        onDragEnd={handleDragEnd}
                        className="cursor-grab active:cursor-grabbing"
                    >
                        <MarkdownContent content={slides[index]} className={className} />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* ナビゲーション: 矢印は気配。端では沈黙させる（disabled）。 */}
            <div className="mt-16 flex items-center justify-between">
                <button
                    type="button"
                    onClick={goPrev}
                    disabled={isFirst}
                    aria-label="前へ"
                    className="text-ghost text-sm tracking-widest font-light transition-colors duration-[var(--duration-whisper)] hover:text-ink disabled:opacity-0 disabled:pointer-events-none"
                >
                    ← 前
                </button>

                {/* 進捗ドット: 現在位置だけがink、他はedge。微かな手がかり。 */}
                <div className="flex items-center gap-3">
                    {slides.map((_, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => goTo(i, i > index ? 1 : -1)}
                            aria-label={`${i + 1}枚目へ`}
                            aria-current={i === index}
                            className={`h-1.5 w-1.5 rounded-full transition-all duration-[var(--duration-whisper)] ${
                                i === index
                                    ? 'bg-ink scale-100'
                                    : 'bg-edge scale-75 hover:bg-ghost'
                            }`}
                        />
                    ))}
                </div>

                <button
                    type="button"
                    onClick={goNext}
                    disabled={isLast}
                    aria-label="次へ"
                    className="text-ghost text-sm tracking-widest font-light transition-colors duration-[var(--duration-whisper)] hover:text-ink disabled:opacity-0 disabled:pointer-events-none"
                >
                    次 →
                </button>
            </div>
        </div>
    );
}
