'use client';

/**
 * Pagination - 共通ページネーションコンポーネント
 *
 * URLベースのページネーションを管理。
 * 件数セレクター、ページ番号、前へ/次へボタンを提供。
 */

import { useMemo, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

// =======================================
// Types
// =======================================

export type ItemsPerPageOption = 5 | 10 | 50 | 100;

export interface PaginationProps<T> {
    /** すべてのアイテム */
    items: T[];
    /** 表示件数オプション（デフォルト: [5, 10, 50]） */
    itemsPerPageOptions?: readonly ItemsPerPageOption[];
    /** デフォルトの表示件数（デフォルト: 5） */
    defaultItemsPerPage?: ItemsPerPageOption;
    /** 子コンポーネントに現在のページのアイテムを渡す */
    children: (paginatedItems: T[]) => React.ReactNode;
    /** スタイルバリアント（デフォルト: 'default'） */
    variant?: 'default' | 'minimal';
    /** 件数セレクターを表示するか（デフォルト: true） */
    showItemsPerPageSelector?: boolean;
    /** 件数情報を表示するか（デフォルト: true） */
    showItemCount?: boolean;
}

// =======================================
// Hook: usePagination
// =======================================

export function usePagination<T>(
    items: T[],
    options?: {
        itemsPerPageOptions?: readonly ItemsPerPageOption[];
        defaultItemsPerPage?: ItemsPerPageOption;
    }
) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();

    const itemsPerPageOptions = options?.itemsPerPageOptions ?? [5, 10, 50];
    const defaultItemsPerPage = options?.defaultItemsPerPage ?? 5;

    // URLから表示件数を取得
    const itemsPerPage = useMemo<ItemsPerPageOption>(() => {
        const limitParam = searchParams.get('limit');
        if (!limitParam) return defaultItemsPerPage;

        const limit = parseInt(limitParam, 10);
        const isValidOption = itemsPerPageOptions.some(opt => opt === limit);
        return isValidOption ? (limit as ItemsPerPageOption) : defaultItemsPerPage;
    }, [searchParams, itemsPerPageOptions, defaultItemsPerPage]);

    // URLから現在のページを取得
    const currentPage = useMemo(() => {
        const pageParam = searchParams.get('page');
        if (!pageParam) return 1;
        const page = parseInt(pageParam, 10);
        return Math.max(1, page);
    }, [searchParams]);

    // 総ページ数
    const totalPages = useMemo(
        () => Math.ceil(items.length / itemsPerPage),
        [items.length, itemsPerPage]
    );

    // 現在のページのアイテム
    const currentItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return items.slice(startIndex, endIndex);
    }, [items, currentPage, itemsPerPage]);

    // 表示件数変更
    const handleItemsPerPageChange = useCallback((newItemsPerPage: ItemsPerPageOption) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('limit', newItemsPerPage.toString());
        params.set('page', '1');
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [router, pathname, searchParams]);

    // ページ変更
    const goToPage = useCallback((page: number) => {
        const targetPage = Math.max(1, Math.min(page, totalPages));
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', targetPage.toString());
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [router, pathname, searchParams, totalPages]);

    return {
        currentItems,
        currentPage,
        totalPages,
        itemsPerPage,
        itemsPerPageOptions,
        totalItems: items.length,
        handleItemsPerPageChange,
        goToPage,
    };
}

// =======================================
// Component: Pagination
// =======================================

export function Pagination<T>({
    items,
    itemsPerPageOptions = [5, 10, 50],
    defaultItemsPerPage = 5,
    children,
    variant = 'default',
    showItemsPerPageSelector = true,
    showItemCount = true,
}: PaginationProps<T>) {
    const {
        currentItems,
        currentPage,
        totalPages,
        itemsPerPage,
        totalItems,
        handleItemsPerPageChange,
        goToPage,
    } = usePagination(items, { itemsPerPageOptions, defaultItemsPerPage });

    const isMinimal = variant === 'minimal';

    return (
        <div className={isMinimal ? '' : 'space-y-4'}>
            {/* 件数セレクター & 表示件数情報 */}
            {(showItemsPerPageSelector || showItemCount) && (
                <div className={`flex flex-wrap items-center justify-between gap-4 ${isMinimal ? 'mb-[var(--space-md)]' : 'py-2 border-b border-edge/30'}`}>
                    {showItemsPerPageSelector && (
                        <div className="flex items-center gap-2">
                            <span className={`${isMinimal ? 'text-[10px] text-ghost opacity-50' : 'text-xs text-ghost'}`}>表示{isMinimal ? '' : ':'}</span>
                            <div className={`flex ${isMinimal ? 'gap-1' : 'border border-edge rounded overflow-hidden'}`}>
                                {itemsPerPageOptions.map((option) => (
                                    <button
                                        key={option}
                                        onClick={() => handleItemsPerPageChange(option)}
                                        className={
                                            isMinimal
                                                ? `px-2 py-1 text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${itemsPerPage === option
                                                    ? 'text-ink border-b border-[var(--color-edge)]'
                                                    : 'text-ghost opacity-50 hover:opacity-100'
                                                }`
                                                : `px-3 py-1 text-xs transition-colors ${itemsPerPage === option
                                                    ? 'bg-ink text-void'
                                                    : 'bg-void text-ghost hover:bg-edge/20'
                                                }`
                                        }
                                    >
                                        {option}
                                    </button>
                                ))}
                            </div>
                            <span className={`${isMinimal ? 'text-[10px] text-ghost opacity-50' : 'text-xs text-ghost'}`}>件</span>
                        </div>
                    )}

                    {showItemCount && (
                        <span className={`${isMinimal ? 'text-[10px] text-ghost opacity-30' : 'text-xs text-ghost'}`}>
                            {totalItems}件中 {(currentPage - 1) * itemsPerPage + 1}-
                            {Math.min(currentPage * itemsPerPage, totalItems)}件{isMinimal ? 'を表示' : ''}
                        </span>
                    )}
                </div>
            )}

            {/* コンテンツ */}
            {children(currentItems)}

            {/* ページネーションコントロール */}
            {totalPages > 1 && (
                <div className={`flex justify-center items-center gap-4 ${isMinimal ? 'mt-[var(--space-lg)]' : 'mt-6'}`}>
                    {/* 前へ */}
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={
                            isMinimal
                                ? `text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${currentPage === 1
                                    ? 'text-ghost opacity-20 cursor-not-allowed'
                                    : 'text-ghost hover:text-ink'
                                }`
                                : 'text-xs px-3 py-1 rounded border border-edge text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-edge/20 transition-colors'
                        }
                    >
                        {isMinimal ? '← 前へ' : '前へ'}
                    </button>

                    {/* ページ番号 */}
                    <div className={`flex items-center ${isMinimal ? 'gap-2' : 'gap-1'}`}>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                            const showPage =
                                page === 1 ||
                                page === totalPages ||
                                Math.abs(page - currentPage) <= 1;

                            const showEllipsisBefore = page === currentPage - 2 && currentPage > 3;
                            const showEllipsisAfter = page === currentPage + 2 && currentPage < totalPages - 2;

                            if (!showPage && !showEllipsisBefore && !showEllipsisAfter) {
                                return null;
                            }

                            if (showEllipsisBefore || showEllipsisAfter) {
                                return (
                                    <span
                                        key={`ellipsis-${page}`}
                                        className={`${isMinimal ? 'text-[10px] text-ghost opacity-30' : 'text-xs text-ghost px-1'}`}
                                    >
                                        ...
                                    </span>
                                );
                            }

                            return (
                                <button
                                    key={page}
                                    onClick={() => goToPage(page)}
                                    className={
                                        isMinimal
                                            ? `w-6 h-6 text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${currentPage === page
                                                ? 'text-ink border border-[var(--color-edge)]'
                                                : 'text-ghost opacity-50 hover:opacity-100'
                                            }`
                                            : `w-8 h-8 text-xs flex items-center justify-center rounded transition-colors ${currentPage === page
                                                ? 'bg-ink text-void font-medium'
                                                : 'text-ghost hover:bg-edge/20'
                                            }`
                                    }
                                    style={isMinimal ? { clipPath: 'polygon(5% 0%, 100% 5%, 95% 100%, 0% 95%)' } : undefined}
                                >
                                    {page}
                                </button>
                            );
                        })}
                    </div>

                    {/* 次へ */}
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={
                            isMinimal
                                ? `text-[10px] tracking-wider transition-all duration-[var(--duration-subtle)] ${currentPage === totalPages
                                    ? 'text-ghost opacity-20 cursor-not-allowed'
                                    : 'text-ghost hover:text-ink'
                                }`
                                : 'text-xs px-3 py-1 rounded border border-edge text-ink disabled:opacity-30 disabled:cursor-not-allowed hover:bg-edge/20 transition-colors'
                        }
                    >
                        {isMinimal ? '次へ →' : '次へ'}
                    </button>
                </div>
            )}
        </div>
    );
}
