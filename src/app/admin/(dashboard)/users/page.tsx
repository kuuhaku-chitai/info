/**
 * 空白地帯 - ユーザー管理ページ
 *
 * 全管理者ユーザーの一覧表示。
 * アバター・名前・ユーザー名を確認し、編集ページへ遷移できる。
 */

import Link from 'next/link';
import Image from 'next/image';
import { fetchAllUsers } from '@/lib/actions';
import { getOptimizedImageUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const users = await fetchAllUsers();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-ink tracking-wide">
          ユーザー管理
        </h1>
        <p className="text-xs text-ghost mt-1">
          管理者ユーザーの一覧
        </p>
      </div>

      <div className="space-y-2">
        {users.map((user) => {
          const initial = user.displayName.charAt(0).toUpperCase();
          return (
            <Link
              key={user.id}
              href={`/users/${user.id}`}
              className="flex items-center gap-4 p-4 border border-edge rounded hover:border-ghost transition-colors"
            >
              {/* アバター */}
              <div className="w-10 h-10 rounded-full overflow-hidden border border-edge flex items-center justify-center bg-edge/30 shrink-0">
                {user.avatarUrl ? (
                  <Image
                    src={getOptimizedImageUrl(user.avatarUrl)}
                    alt={user.displayName}
                    width={40}
                    height={40}
                    className="object-cover w-full h-full"
                    unoptimized
                  />
                ) : (
                  <span className="text-sm text-ghost font-medium">{initial}</span>
                )}
              </div>

              {/* 名前 */}
              <div className="min-w-0">
                <p className="text-sm text-ink truncate">{user.displayName}</p>
                <p className="text-xs text-ghost">@{user.username}</p>
              </div>

              {/* 編集アイコン */}
              <span className="ml-auto text-xs text-ghost">編集</span>
            </Link>
          );
        })}

        {users.length === 0 && (
          <p className="text-xs text-ghost py-8 text-center">
            ユーザーがいません
          </p>
        )}
      </div>
    </div>
  );
}
