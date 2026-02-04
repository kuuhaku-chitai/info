/**
 * 空白地帯 - カレンダーユーティリティ
 *
 * 月・週・日表示に必要な日付計算関数群。
 * シンプルで軽量な実装。
 */

import type { Post } from '@/types';

// ============================================
// 型定義
// ============================================

export type CalendarViewMode = 'month' | 'week' | 'day';

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: Post[];
}

export interface CalendarWeek {
  days: CalendarDay[];
}

// ============================================
// 日付ユーティリティ
// ============================================

/** 日付を YYYY-MM-DD 形式の文字列に変換 */
export function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 2つの日付が同じ日かどうか */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 日付が今日かどうか */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** 月の最初の日を取得 */
export function getFirstDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** 月の最後の日を取得 */
export function getLastDayOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** 週の最初の日（日曜日）を取得 */
export function getFirstDayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 週の最後の日（土曜日）を取得 */
export function getLastDayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (6 - day));
  d.setHours(23, 59, 59, 999);
  return d;
}

/** 日付を n 日進める/戻す */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** 日付を n ヶ月進める/戻す */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** 日付を n 週進める/戻す */
export function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

// ============================================
// イベントと日付のマッチング
// ============================================

/** イベントが指定日に該当するかどうか */
export function isEventOnDate(event: Post, date: Date): boolean {
  if (!event.eventStartDate) return false;

  const startDate = new Date(event.eventStartDate);
  startDate.setHours(0, 0, 0, 0);

  const endDate = event.eventEndDate
    ? new Date(event.eventEndDate)
    : new Date(event.eventStartDate);
  endDate.setHours(23, 59, 59, 999);

  const targetDate = new Date(date);
  targetDate.setHours(12, 0, 0, 0);

  return targetDate >= startDate && targetDate <= endDate;
}

/** イベントが指定期間に重なるかどうか */
export function isEventInRange(event: Post, rangeStart: Date, rangeEnd: Date): boolean {
  if (!event.eventStartDate) return false;

  const eventStart = new Date(event.eventStartDate);
  eventStart.setHours(0, 0, 0, 0);

  const eventEnd = event.eventEndDate
    ? new Date(event.eventEndDate)
    : new Date(event.eventStartDate);
  eventEnd.setHours(23, 59, 59, 999);

  return eventStart <= rangeEnd && eventEnd >= rangeStart;
}

/** イベントが複数日にまたがるかどうか */
export function isMultiDayEvent(event: Post): boolean {
  if (!event.eventStartDate || !event.eventEndDate) return false;
  return event.eventStartDate !== event.eventEndDate;
}

/** イベントの開始日が指定日かどうか */
export function isEventStartDate(event: Post, date: Date): boolean {
  if (!event.eventStartDate) return false;
  const startDate = new Date(event.eventStartDate);
  return isSameDay(startDate, date);
}

/** イベントの終了日が指定日かどうか */
export function isEventEndDate(event: Post, date: Date): boolean {
  if (!event.eventEndDate) return false;
  const endDate = new Date(event.eventEndDate);
  return isSameDay(endDate, date);
}

// ============================================
// カレンダーグリッド生成
// ============================================

/** 月表示用のカレンダーグリッドを生成 */
export function generateMonthGrid(
  targetDate: Date,
  events: Post[]
): CalendarWeek[] {
  const weeks: CalendarWeek[] = [];
  const firstDay = getFirstDayOfMonth(targetDate);
  const lastDay = getLastDayOfMonth(targetDate);

  // 月の最初の週の日曜日から開始
  let currentDate = getFirstDayOfWeek(firstDay);

  // 6週間分生成（カレンダーの行数を固定）
  for (let week = 0; week < 6; week++) {
    const days: CalendarDay[] = [];

    for (let day = 0; day < 7; day++) {
      const date = new Date(currentDate);
      const dayEvents = events.filter((e) => isEventOnDate(e, date));

      days.push({
        date,
        isCurrentMonth:
          date.getMonth() === targetDate.getMonth() &&
          date.getFullYear() === targetDate.getFullYear(),
        isToday: isToday(date),
        events: dayEvents,
      });

      currentDate = addDays(currentDate, 1);
    }

    weeks.push({ days });

    // 月末を過ぎて次の週に入ったら終了（ただし最低4週間は表示）
    if (week >= 3 && currentDate > lastDay) {
      break;
    }
  }

  return weeks;
}

/** 週表示用のカレンダーデータを生成 */
export function generateWeekData(
  targetDate: Date,
  events: Post[]
): CalendarDay[] {
  const days: CalendarDay[] = [];
  let currentDate = getFirstDayOfWeek(targetDate);

  for (let i = 0; i < 7; i++) {
    const date = new Date(currentDate);
    const dayEvents = events.filter((e) => isEventOnDate(e, date));

    days.push({
      date,
      isCurrentMonth: true, // 週表示では常に true
      isToday: isToday(date),
      events: dayEvents,
    });

    currentDate = addDays(currentDate, 1);
  }

  return days;
}

/** 日表示用のイベントリストを取得 */
export function getDayEvents(targetDate: Date, events: Post[]): Post[] {
  return events.filter((e) => isEventOnDate(e, targetDate));
}

// ============================================
// フォーマッター
// ============================================

const WEEKDAY_LABELS_JA = ['日', '月', '火', '水', '木', '金', '土'];
const WEEKDAY_LABELS_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function getWeekdayLabel(index: number, short = false): string {
  return short ? WEEKDAY_LABELS_SHORT[index] : WEEKDAY_LABELS_JA[index];
}

export function formatMonthYear(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

export function formatWeekRange(date: Date): string {
  const start = getFirstDayOfWeek(date);
  const end = getLastDayOfWeek(date);
  const startStr = `${start.getMonth() + 1}/${start.getDate()}`;
  const endStr = `${end.getMonth() + 1}/${end.getDate()}`;
  return `${startStr} - ${endStr}`;
}

export function formatDayFull(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日（${WEEKDAY_LABELS_JA[date.getDay()]}）`;
}
