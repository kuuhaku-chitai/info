'use client';

/**
 * 空白地帯 - 詳細パネル
 *
 * ノードを選んだとき、右側に静かに滑り込むパネル。
 * 画像ギャラリー・変更理由・そして「空間の記憶（memory）」を読むための場。
 * memory はこのパネルでも別格に扱い、余白を多めに、本文より大きく静かに置く。
 *
 * アニメーションは微弱・有機的（速い動き・派手なエフェクトは禁止）。
 */

import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { useHistoryStore } from './historyStore';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { getOptimizedImageUrl } from '@/lib/utils';

export function DetailPanel() {
  const selectedId = useHistoryStore((s) => s.selectedId);
  const detail = useHistoryStore((s) => s.detail);
  const loadingDetail = useHistoryStore((s) => s.loadingDetail);
  const closeDetail = useHistoryStore((s) => s.closeDetail);

  const isOpen = selectedId !== null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景の薄い覆い（クリックで閉じる）。空白を消さないよう、ごく淡く */}
          <motion.div
            className="absolute inset-0 bg-[var(--color-void)]/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onClick={closeDetail}
          />

          {/* パネル本体 */}
          <motion.aside
            className="absolute top-0 right-0 h-full w-full max-w-md bg-[var(--color-void)] border-l border-edge overflow-y-auto"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-8 py-10">
              {/* 閉じる */}
              <button
                onClick={closeDetail}
                className="text-xs text-ghost hover:text-ink transition-colors mb-8"
                aria-label="閉じる"
              >
                ✕ 閉じる
              </button>

              {loadingDetail && !detail ? (
                <p className="text-xs text-ghost py-8">読み込み中...</p>
              ) : detail ? (
                <article className="space-y-8">
                  {/* 見出し */}
                  <header className="space-y-2">
                    <p className="text-[10px] text-ghost tracking-wide">
                      {detail.createdAt.slice(0, 10)}
                      {detail.author ? ` ・ ${detail.author}` : ''}
                    </p>
                    <h2 className="text-lg font-light text-ink tracking-wide leading-relaxed">
                      {detail.title}
                    </h2>
                    {detail.locationNote && (
                      <p className="text-xs text-ghost">{detail.locationNote}</p>
                    )}
                  </header>

                  {/* 画像ギャラリー（順序 = 変容の連なり） */}
                  {detail.images.length > 0 && (
                    <div className="space-y-6">
                      {detail.images.map((img) => (
                        <figure key={img.id} className="space-y-2">
                          <div className="relative w-full aspect-video overflow-hidden rounded bg-edge/30">
                            <Image
                              src={getOptimizedImageUrl(img.imageUrl)}
                              alt={img.caption || detail.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          {img.caption && (
                            <figcaption className="text-[10px] text-ghost">{img.caption}</figcaption>
                          )}
                        </figure>
                      ))}
                    </div>
                  )}

                  {/* 変更理由 */}
                  {detail.reason && (
                    <section className="space-y-2">
                      <h3 className="text-xs text-ghost tracking-wide">変更理由</h3>
                      <p className="text-sm text-ink font-light leading-[2] whitespace-pre-wrap">
                        {detail.reason}
                      </p>
                    </section>
                  )}

                  {/* 本文（Markdown / mermaid対応） */}
                  {detail.content.trim() && (
                    <section>
                      <MarkdownRenderer content={detail.content} />
                    </section>
                  )}

                  {/* 空間の記憶（memory）— 別格に、静かに大きく */}
                  {detail.memory && (
                    <section className="pt-8 mt-2 border-t border-edge/60 space-y-4">
                      <h3 className="text-sm font-light text-ink tracking-[0.2em]">空間の記憶</h3>
                      <p className="text-sm text-ink font-light leading-[2.2] whitespace-pre-wrap">
                        {detail.memory}
                      </p>
                    </section>
                  )}
                </article>
              ) : (
                <p className="text-xs text-ghost py-8">記録を読み込めませんでした。</p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
