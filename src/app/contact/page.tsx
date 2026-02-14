/**
 * 空白地帯 - お問い合わせページ
 *
 * 外部との接点。最小限の構成で、余白を保つ。
 */

import type { Metadata } from 'next';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'お問い合わせ - 空白地帯',
  description: '空白地帯へのお問い合わせはこちらから。',
};

export default function ContactPage() {
  // Turnstile Site Key（環境変数から）
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';

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

        {/* 戻るリンク */}
        <div className="pt-4">
          <a
            href="/"
            className="text-xs text-ghost hover:text-ink transition-colors duration-[var(--duration-subtle)]"
          >
            ← 戻る
          </a>
        </div>
      </div>
    </div>
  );
}
