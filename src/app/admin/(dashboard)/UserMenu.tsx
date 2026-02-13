'use client';

/**
 * 空白地帯 - UserMenu
 *
 * アバターアイコンをクリックでドロップダウン表示。
 * 表示名 + ログアウトボタン。
 * アバター未設定時はイニシャルアイコン（displayName の先頭1文字）。
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getOptimizedImageUrl } from '@/lib/utils';

interface UserMenuProps {
  user: {
    displayName: string;
    avatarUrl?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 外側クリックで閉じる
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  }

  // イニシャル（先頭1文字）
  const initial = user.displayName.charAt(0).toUpperCase();

  return (
    <div className="relative" ref={menuRef}>
      {/* アバターボタン */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-8 h-8 rounded-full overflow-hidden border border-edge hover:border-ghost transition-colors flex items-center justify-center bg-edge/30"
      >
        {user.avatarUrl ? (
          <Image
            src={getOptimizedImageUrl(user.avatarUrl)}
            alt={user.displayName}
            width={32}
            height={32}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <span className="text-xs text-ghost font-medium">{initial}</span>
        )}
      </button>

      {/* ドロップダウン */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-void border border-edge rounded shadow-sm z-50">
          <div className="px-4 py-3 border-b border-edge">
            <p className="text-xs text-ink font-medium truncate">
              {user.displayName}
            </p>
          </div>
          <div className="py-1">
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full text-left px-4 py-2 text-xs text-ghost hover:text-ink hover:bg-edge/30 transition-colors disabled:opacity-50"
            >
              {isLoggingOut ? '...' : 'ログアウト'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
