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

  // パネルを閉じる & URLハッシュをクリア（/history#id で開いた場合にURLを戻す）
  function handleClose() {
    closeDetail();
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', '/history');
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 背景の薄い覆い（クリックで閉じる） */}
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            onClick={handleClose}
          />

          {/* × ボタン — ハンバーガーと同じ fixed top-6 right-6 z-60 p-2
              パネルより上に浮かせることでナビ等との重なりを排除 */}
          <motion.button
            onClick={handleClose}
            className="fixed top-6 right-6 z-60 p-2 text-ghost bg-white hover:text-ink transition-colors focus:outline-none"
            aria-label="閉じる"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="w-6 h-6 flex flex-col justify-center items-center gap-0">
              <span className="block h-px w-6 bg-current rotate-45 translate-y-px" />
              <span className="block h-px w-6 bg-current -rotate-45 -translate-y-px" />
            </div>
          </motion.button>

          {/* パネル本体 — z-50 で全要素の最上位に */}
          <motion.aside
            className="absolute top-0 right-0 h-full w-full max-w-md bg-white border-l border-edge overflow-y-auto z-50"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* パネル上部の余白（fixed ×ボタンと被らないよう確保） */}
            <div className="px-8 pt-16 pb-8">
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
