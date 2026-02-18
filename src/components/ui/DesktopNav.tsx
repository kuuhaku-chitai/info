'use client';

/**
 * DesktopNav - デスクトップ用共通ナビゲーション
 *
 * 全ページで統一されたナビゲーションリンクを提供。
 * MobileMenuのPC版として、サイト内の主要リンクを控えめに表示。
 *
 * variant:
 * - "corner": void-embraceレイアウト用。左下角に絶対配置。
 * - "footer": スクロールコンテンツ用。max-w-2xl内のfooterとして配置。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Page } from '@/types';

interface DesktopNavProps {
    pages?: Page[];
    variant: 'corner' | 'footer';
}

// サイト内の固定リンク
const STATIC_LINKS = [
    { href: '/blog', label: '記録' },
    { href: '/schedule', label: '予定' },
    { href: '/projects', label: 'プロジェクト' },
    { href: '/contact', label: '問い合わせ' },
];

export function DesktopNav({ pages = [], variant }: DesktopNavProps) {
    const pathname = usePathname();

    // 固定リンク + 動的ページリンク
    const allLinks = [
        ...STATIC_LINKS,
        ...pages.map((p) => ({ href: `/${p.path}`, label: p.title })),
    ];

    // variant別のラッパースタイル
    const wrapperClassName = variant === 'corner'
        ? 'hug-corner-bl z-10 hidden md:block'
        : 'max-w-2xl mx-auto mt-16 pt-8 border-t border-edge hidden md:block';

    return (
        <nav className={wrapperClassName}>
            <ul className="flex gap-4 text-xs text-ghost">
                {allLinks.map((link) => {
                    // 現在のページかどうかを判定
                    const isCurrent = pathname === link.href
                        || pathname.startsWith(link.href + '/');

                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                className={`
                                    hover:text-ink transition-colors duration-[var(--duration-subtle)]
                                    ${isCurrent ? 'opacity-30' : ''}
                                `}
                                aria-current={isCurrent ? 'page' : undefined}
                            >
                                {link.label}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
