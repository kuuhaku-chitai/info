/**
 * 空白地帯 - お問い合わせページ
 *
 * 外部との接点。最小限の構成で、余白を保つ。
 */

import type { Metadata } from 'next';
import { ContactForm } from './ContactForm';
import { MobileMenu } from '@/components/ui/MobileMenu';
import { DesktopNav } from '@/components/ui/DesktopNav';
import { fetchAllSocialLinks, fetchPublishedPages } from '@/lib/actions';

export const metadata: Metadata = {
  title: 'お問い合わせ',
  description: '空白地帯へのお問い合わせはこちらから。',
  openGraph: {
    title: 'お問い合わせ',
    description: '空白地帯へのお問い合わせはこちらから。',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'お問い合わせ',
    description: '空白地帯へのお問い合わせはこちらから。',
  },
};

export const dynamic = 'force-dynamic';

export default async function ContactPage() {
  // Turnstile Site Key（環境変数から）
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

  const [socialLinks, pages] = await Promise.all([
    fetchAllSocialLinks(),
    fetchPublishedPages(),
  ]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg space-y-8">
        {/* ページタイトル — 控えめに */}
        <div>
          <h1 className="text-sm font-medium text-ink tracking-wide">
            お問い合わせ
          </h1>
          <p className="text-xs text-ghost mt-2 leading-relaxed">
            ご質問・ご依頼・取材等のお問い合わせを受け付けています。<br />
            通常、2〜3営業日以内にご返信いたします。
          </p>
        </div>

        {/* フォーム */}
        <ContactForm siteKey={siteKey} />

        {/* デスクトップナビゲーション */}
        <DesktopNav variant="footer" pages={pages} />
      </div>

      <MobileMenu socialLinks={socialLinks} pages={pages} />
    </div>
  );
}
