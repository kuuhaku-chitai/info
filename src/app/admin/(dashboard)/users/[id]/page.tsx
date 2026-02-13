/**
 * 空白地帯 - ユーザー編集ページ
 *
 * 個別ユーザーの表示名・アバター・パスワードを編集。
 */

import { notFound } from 'next/navigation';
import { fetchUserById } from '@/lib/actions';
import { UserForm } from '../UserForm';

export const dynamic = 'force-dynamic';

export default async function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await fetchUserById(id);

  if (!user) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-lg font-medium text-ink tracking-wide">
          ユーザー編集
        </h1>
        <p className="text-xs text-ghost mt-1">
          @{user.username}
        </p>
      </div>

      <UserForm user={user} />
    </div>
  );
}
