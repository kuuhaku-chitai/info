/**
 * 空白地帯 - 新規ソーシャルリンク作成ページ
 */

import { SocialLinkForm } from '../SocialLinkForm';

export default function NewSocialLinkPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-ink tracking-wide">
        新規ソーシャルリンク
      </h1>
      <SocialLinkForm />
    </div>
  );
}
