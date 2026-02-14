'use client';

/**
 * 空白地帯 - お問い合わせフォーム
 *
 * useState + useTransition パターン（既存フォームと統一）。
 * Cloudflare Turnstile でbot対策。
 */

import { useState, useTransition, useRef } from 'react';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import type { InquiryType } from '@/types';

// Props の型定義を追加
interface ContactFormProps {
  siteKey: string;
}

/** 問い合わせ種別のラベル */
const INQUIRY_TYPE_OPTIONS: { value: InquiryType; label: string }[] = [
  { value: 'general', label: '一般的なお問い合わせ' },
  { value: 'collaboration', label: 'コラボレーション・協業' },
  { value: 'commission', label: '制作依頼' },
  { value: 'media', label: '取材・メディア関連' },
  { value: 'other', label: 'その他' },
];

export function ContactForm({ siteKey }: ContactFormProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [inquiryType, setInquiryType] = useState<InquiryType>('general');
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // クライアントバリデーション
    if (!name.trim()) {
      setError('お名前を入力してください');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('有効なメールアドレスを入力してください');
      return;
    }
    if (!message.trim()) {
      setError('お問い合わせ内容を入力してください');
      return;
    }
    if (!turnstileToken) {
      setError('認証チェックを完了してください');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim(),
            email: email.trim(),
            phone: phone.trim() || undefined,
            organization: organization.trim() || undefined,
            inquiryType,
            message: message.trim(),
            turnstileToken,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || '送信に失敗しました');
          // Turnstile をリセット
          turnstileRef.current?.reset();
          setTurnstileToken(null);
          return;
        }

        setSubmitted(true);
      } catch {
        setError('送信に失敗しました。しばらく経ってから再度お試しください');
        turnstileRef.current?.reset();
        setTurnstileToken(null);
      }
    });
  }

  // 送信完了画面
  if (submitted) {
    return (
      <div className="space-y-4 py-8">
        <p className="text-sm text-ink">送信が完了しました。</p>
        <p className="text-xs text-ghost leading-relaxed">
          ご入力いただいたメールアドレスに確認メールをお送りしました。<br />
          内容を確認のうえ、改めてご連絡いたします。
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setName('');
            setEmail('');
            setPhone('');
            setOrganization('');
            setInquiryType('general');
            setMessage('');
            setTurnstileToken(null);
            turnstileRef.current?.reset();
          }}
          className="text-xs text-ghost hover:text-ink transition-colors"
        >
          別の問い合わせを送る
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* お名前 */}
      <div className="space-y-1.5">
        <label className="block text-xs text-ghost">
          お名前 <span className="text-[var(--color-critical)]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        />
      </div>

      {/* メールアドレス */}
      <div className="space-y-1.5">
        <label className="block text-xs text-ghost">
          メールアドレス <span className="text-[var(--color-critical)]">*</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        />
      </div>

      {/* 電話番号 */}
      <div className="space-y-1.5">
        <label className="block text-xs text-ghost">電話番号</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        />
      </div>

      {/* 団体名・会社名 */}
      <div className="space-y-1.5">
        <label className="block text-xs text-ghost">団体名・会社名</label>
        <input
          type="text"
          value={organization}
          onChange={(e) => setOrganization(e.target.value)}
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        />
      </div>

      {/* 問い合わせ種別 */}
      <div className="space-y-1.5">
        <label className="block text-xs text-ghost">
          問い合わせ種別 <span className="text-[var(--color-critical)]">*</span>
        </label>
        <select
          value={inquiryType}
          onChange={(e) => setInquiryType(e.target.value as InquiryType)}
          required
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors"
        >
          {INQUIRY_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* お問い合わせ内容 */}
      <div className="space-y-1.5">
        <label className="block text-xs text-ghost">
          お問い合わせ内容 <span className="text-[var(--color-critical)]">*</span>
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={6}
          className="w-full px-3 py-2 text-sm text-ink bg-transparent border border-edge rounded focus:border-ghost focus:outline-none transition-colors resize-y"
        />
      </div>

      {/* Turnstile */}
      {siteKey && (
        <div>
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={setTurnstileToken}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
            options={{
              theme: 'light',
              size: 'normal',
            }}
          />
        </div>
      )}

      {/* エラーメッセージ */}
      {error && (
        <p className="text-xs text-[var(--color-critical)]">{error}</p>
      )}

      {/* 送信ボタン */}
      <button
        type="submit"
        disabled={isPending}
        className="px-6 py-2.5 bg-ink text-void text-xs rounded hover:opacity-80 transition-opacity disabled:opacity-50"
      >
        {isPending ? '送信中...' : '送信する'}
      </button>
    </form>
  );
}
