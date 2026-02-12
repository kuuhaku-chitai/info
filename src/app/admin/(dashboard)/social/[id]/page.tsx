/**
 * 空白地帯 - ソーシャルリンク編集ページ
 */

import { notFound } from 'next/navigation';
import { fetchSocialLinkById } from '@/lib/actions';
import { SocialLinkForm } from '../SocialLinkForm';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSocialLinkPage({ params }: PageProps) {
  const { id } = await params;
  const link = await fetchSocialLinkById(id);

  if (!link) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-ink tracking-wide">
        ソーシャルリンクを編集
      </h1>
      <SocialLinkForm link={link} />
    </div>
  );
}
