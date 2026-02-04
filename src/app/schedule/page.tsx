/**
 * 空白地帯 - スケジュール（予定）ページ
 *
 * イベント（展示、パフォーマンス等）を表示。
 * リストモードとカレンダーモードの切り替えが可能。
 *
 * 「空白」のコンセプトを維持しながら、
 * イベント情報を控えめに提示する。
 */

import { fetchPostsByCategory } from '@/lib/actions';
import { ScheduleContent } from './ScheduleContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: '予定',
  description: 'イベント、展示、パフォーマンスの予定。',
};

export default async function SchedulePage() {
  const events = await fetchPostsByCategory('event');

  return <ScheduleContent events={events} />;
}
