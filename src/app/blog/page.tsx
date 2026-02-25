/**
 * 空白地帯 - ブログ（記録）ページ
 *
 * 「天井から吊るされた思考の断片」
 *
 * 単なるリストではなく、物理的なインスタレーションとして
 * 記事を3D空間に配置する。各記事は細い紐で天井から吊るされ、
 * 微風（Perlin Noise）の影響を受けて常に揺れ続けている。
 *
 * 徘徊するキャラクター（sheep, sheep_person）が
 * 記事に「ぶつかる」ことで、大きな揺れを生み出す。
 */

import { fetchPublishedPosts, fetchAllSocialLinks, fetchPublishedPages } from '@/lib/actions';
import { BlogContent } from './BlogContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '記録',
  description: '断片的な思考、エッセイ、メモの蓄積。',
  openGraph: {
    title: '記録',
    description: '断片的な思考、エッセイ、メモの蓄積。',
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: '記録',
    description: '断片的な思考、エッセイ、メモの蓄積。',
  },
};

export default async function BlogPage() {
  // サーバーサイドでデータを取得
  const [allPosts, socialLinks, pages] = await Promise.all([
    fetchPublishedPosts(),
    fetchAllSocialLinks(),
    fetchPublishedPages(),
  ]);

  // イベントとお知らせ以外の投稿（記事とメモ）を表示
  const posts = allPosts.filter((post) => post.category !== 'event' && post.category !== 'news');

  // クライアントコンポーネントにデータを渡す
  return <BlogContent posts={posts} socialLinks={socialLinks} pages={pages} />;
}
