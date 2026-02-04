'use client';

/**
 * MobileMenu - モバイル用ハンバーガーメニュー
 *
 * モバイル端末でのナビゲーションを提供。
 * Next.js Toolbarなどの下部固定要素との干渉を避けるため、
 * コンテンツをオーバーレイとして表示する。
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { type SocialLink } from '@/types';

interface MobileMenuProps {
    socialLinks?: SocialLink[];
}

export function MobileMenu({ socialLinks = [] }: MobileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const pathname = usePathname();

    // ページ遷移時にメニューを閉じる
    useEffect(() => {
        setIsOpen(false);
    }, [pathname]);

    // スクロール制御
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    const toggleMenu = () => setIsOpen(!isOpen);

    // メニュー項目
    const links = [
        { href: '/', label: 'ホーム' },
        { href: '/blog', label: '記録' },
        { href: '/schedule', label: '予定' },
    ];

    return (
        <div className="md:hidden z-50">
            {/* ハンバーガーボタン: 右上に固定 */}
            <button
                onClick={toggleMenu}
                className="fixed top-6 right-6 z-50 p-2 text-ghost hover:text-ink transition-colors duration-300 focus:outline-none"
                aria-label={isOpen ? 'メニューを閉じる' : 'メニューを開く'}
            >
                <div className="w-6 h-6 flex flex-col justify-center items-end gap-1.5">
                    <span
                        className={`block h-px bg-current transition-all duration-300 bg-[var(--color-ink)] ${isOpen ? 'w-6 rotate-45 translate-y-1.5' : 'w-6'
                            }`}
                    />
                    <span
                        className={`block h-px bg-current transition-all duration-300 bg-[var(--color-ink)] ${isOpen ? 'w-0 opacity-0' : 'w-4'
                            }`}
                    />
                    <span
                        className={`block h-px bg-current transition-all duration-300 bg-[var(--color-ink)] ${isOpen ? 'w-6 -rotate-45 -translate-y-1.5' : 'w-3'
                            }`}
                    />
                </div>
            </button>

            {/* メニューオーバーレイ */}
            <div
                className={`fixed inset-0 bg-[var(--color-void)] z-40 flex flex-col items-center justify-center transition-opacity duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
            >
                <nav>
                    <ul className="flex flex-col gap-8 text-center">
                        {links.map((link) => (
                            <li key={link.href} className="overflow-hidden">
                                <Link
                                    href={link.href}
                                    className={`block text-ghost text-ml tracking-[0.2em] font-light transition-transform duration-500 hover:text-ghost ${isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                                        }`}
                                    style={{ transitionDelay: isOpen ? '100ms' : '0ms' }}
                                >
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* ソーシャルリンク */}
                {socialLinks.length > 0 && (
                    <div
                        className={`mt-12 flex items-center justify-center gap-4 transition-all duration-500 ${
                            isOpen ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
                        }`}
                        style={{ transitionDelay: isOpen ? '300ms' : '0ms' }}
                    >
                        {socialLinks.map((link) => (
                            <a
                                key={link.id}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={link.title}
                                className="relative w-8 h-8 opacity-50 hover:opacity-100 transition-opacity"
                            >
                                <Image
                                    src={link.iconUrl}
                                    alt={link.title}
                                    fill
                                    className="object-contain"
                                    unoptimized
                                />
                            </a>
                        ))}
                    </div>
                )}

                {/* 装飾: 背景のパーティクル等はglobalsで管理されているが、ここではシンプルに */}
                <div className="absolute bottom-8 left-0 w-full text-center">
                    <span className="text-[10px] text-ghost opacity-30 tracking-[0.5em]">
                        KUHAKU CHITAI
                    </span>
                </div>
            </div>
        </div>
    );
}
