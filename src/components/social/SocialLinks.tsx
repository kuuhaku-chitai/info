/**
 * 空白地帯 - ソーシャルリンク表示コンポーネント
 *
 * PC: トップページ右上に横並びで表示
 * モバイル: ハンバーガーメニュー内で表示（別途対応）
 *
 * コンセプト:
 * - アイコンは小さく、控えめに
 * - ホバーで微かに強調
 * - 「空白」を邪魔しないサイズ感
 */

import Image from 'next/image';
import { type SocialLink } from '@/types';
import { getOptimizedImageUrl } from '@/lib/utils';

interface SocialLinksProps {
  links: SocialLink[];
  /**
   * サイズ: 'small' (24px), 'medium' (32px), 'large' (40px)
   */
  size?: 'small' | 'medium' | 'large';
  /**
   * レイアウト: 'horizontal' (横並び), 'vertical' (縦並び)
   */
  layout?: 'horizontal' | 'vertical';
}

const sizeMap = {
  small: 24,
  medium: 32,
  large: 40,
};

export function SocialLinks({
  links,
  size = 'small',
  layout = 'horizontal',
}: SocialLinksProps) {
  if (links.length === 0) return null;

  const iconSize = sizeMap[size];

  return (
    <div
      className={`
        flex items-center gap-3
        ${layout === 'vertical' ? 'flex-col' : 'flex-row'}
      `}
    >
      {links.map((link) => (
        <a
          key={link.id}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          title={link.title}
          className="relative opacity-50 hover:opacity-100 transition-opacity duration-[var(--duration-subtle)]"
          style={{ width: iconSize, height: iconSize }}
        >
          <Image
            src={getOptimizedImageUrl(link.iconUrl)}
            alt={link.title}
            fill
            className="object-contain"
            unoptimized
          />
        </a>
      ))}
    </div>
  );
}
