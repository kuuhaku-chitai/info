'use client';

/**
 * 空白地帯 - カレンダービュー
 *
 * Googleカレンダー風のシンプルなイベント表示。
 * 月・週・日の切り替えが可能。
 * 複数日にまたがるイベントはバーで表示。
 */

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import type { Post } from '@/types';
import {
  type CalendarViewMode,
  generateMonthGrid,
  generateWeekData,
  getDayEvents,
  formatMonthYear,
  formatWeekRange,
  formatDayFull,
  getWeekdayLabel,
  addMonths,
  addWeeks,
  addDays,
  isMultiDayEvent,
  isEventStartDate,
  isEventEndDate,
  isSameDay,
} from '@/lib/calendar';

interface ScheduleCalendarViewProps {
  events: Post[];
}

export function ScheduleCalendarView({ events }: ScheduleCalendarViewProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState(() => new Date());

  // ナビゲーション
  const navigate = useCallback(
    (direction: 'prev' | 'next') => {
      const delta = direction === 'prev' ? -1 : 1;
      setCurrentDate((prev) => {
        switch (viewMode) {
          case 'month':
            return addMonths(prev, delta);
          case 'week':
            return addWeeks(prev, delta);
          case 'day':
            return addDays(prev, delta);
        }
      });
    },
    [viewMode]
  );

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  // ヘッダータイトル
  const headerTitle = useMemo(() => {
    switch (viewMode) {
      case 'month':
        return formatMonthYear(currentDate);
      case 'week':
        return formatWeekRange(currentDate);
      case 'day':
        return formatDayFull(currentDate);
    }
  }, [viewMode, currentDate]);

  return (
    <div className="calendar-container">
      {/* カレンダーヘッダー */}
      <div className="calendar-header">
        <div className="calendar-nav">
          <button
            onClick={() => navigate('prev')}
            className="calendar-nav-btn"
            aria-label="前へ"
          >
            ←
          </button>
          <button
            onClick={goToToday}
            className="calendar-today-btn"
          >
            今日
          </button>
          <button
            onClick={() => navigate('next')}
            className="calendar-nav-btn"
            aria-label="次へ"
          >
            →
          </button>
        </div>

        <h2 className="calendar-title">{headerTitle}</h2>

        <div className="calendar-mode-switch">
          {(['month', 'week', 'day'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`calendar-mode-btn ${viewMode === mode ? 'active' : ''}`}
            >
              {mode === 'month' ? '月' : mode === 'week' ? '週' : '日'}
            </button>
          ))}
        </div>
      </div>

      {/* カレンダー本体 */}
      <div className="calendar-body">
        {viewMode === 'month' && (
          <MonthView currentDate={currentDate} events={events} />
        )}
        {viewMode === 'week' && (
          <WeekView currentDate={currentDate} events={events} />
        )}
        {viewMode === 'day' && (
          <DayView currentDate={currentDate} events={events} />
        )}
      </div>
    </div>
  );
}

// ============================================
// 月表示
// ============================================

function MonthView({
  currentDate,
  events,
}: {
  currentDate: Date;
  events: Post[];
}) {
  const weeks = useMemo(
    () => generateMonthGrid(currentDate, events),
    [currentDate, events]
  );

  return (
    <div className="month-view">
      {/* 曜日ヘッダー */}
      <div className="weekday-header">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="weekday-cell">
            <span className="weekday-label-full">{getWeekdayLabel(i)}</span>
            <span className="weekday-label-short">{getWeekdayLabel(i, true)}</span>
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className="month-grid">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="week-row">
            {week.days.map((day) => (
              <DayCell key={day.date.toISOString()} day={day} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 週表示
// ============================================

function WeekView({
  currentDate,
  events,
}: {
  currentDate: Date;
  events: Post[];
}) {
  const days = useMemo(
    () => generateWeekData(currentDate, events),
    [currentDate, events]
  );

  return (
    <div className="week-view">
      {/* 曜日ヘッダー（日付付き） */}
      <div className="weekday-header week-header-with-date">
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            className={`weekday-cell ${day.isToday ? 'is-today' : ''}`}
          >
            <span className="weekday-label">{getWeekdayLabel(day.date.getDay())}</span>
            <span className="date-number">{day.date.getDate()}</span>
          </div>
        ))}
      </div>

      {/* イベントリスト */}
      <div className="week-events-grid">
        {days.map((day) => (
          <div key={day.date.toISOString()} className="week-day-column">
            {day.events.map((event) => (
              <EventItem key={event.id} event={event} compact />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// 日表示
// ============================================

function DayView({
  currentDate,
  events,
}: {
  currentDate: Date;
  events: Post[];
}) {
  const dayEvents = useMemo(
    () => getDayEvents(currentDate, events),
    [currentDate, events]
  );

  return (
    <div className="day-view">
      {dayEvents.length === 0 ? (
        <p className="no-events">予定はない。</p>
      ) : (
        <div className="day-events-list">
          {dayEvents.map((event) => (
            <EventItem key={event.id} event={event} detailed />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// 日付セル（月表示用）
// ============================================

function DayCell({ day }: { day: ReturnType<typeof generateMonthGrid>[0]['days'][0] }) {
  const cellClasses = [
    'day-cell',
    !day.isCurrentMonth && 'other-month',
    day.isToday && 'is-today',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cellClasses}>
      <span className="day-number">{day.date.getDate()}</span>
      <div className="day-events">
        {day.events.slice(0, 3).map((event) => (
          <EventBar key={event.id} event={event} date={day.date} />
        ))}
        {day.events.length > 3 && (
          <span className="more-events">+{day.events.length - 3}</span>
        )}
      </div>
    </div>
  );
}

// ============================================
// イベントバー（複数日対応）
// ============================================

function EventBar({ event, date }: { event: Post; date: Date }) {
  const isMultiDay = isMultiDayEvent(event);
  const isStart = isEventStartDate(event, date);
  const isEnd = isEventEndDate(event, date);
  const isSingle = !isMultiDay || (isStart && isEnd);

  // 複数日イベントのバー形状を決定
  let barClass = 'event-bar';
  if (isMultiDay) {
    if (isStart) barClass += ' bar-start';
    else if (isEnd) barClass += ' bar-end';
    else barClass += ' bar-middle';
  }
  if (isSingle) barClass += ' bar-single';

  return (
    <Link href={`/post/${event.id}`} className={barClass} title={event.title}>
      {(isStart || isSingle) && (
        <span className="event-bar-title">{event.title}</span>
      )}
    </Link>
  );
}

// ============================================
// イベントアイテム（リスト表示用）
// ============================================

function EventItem({
  event,
  compact = false,
  detailed = false,
}: {
  event: Post;
  compact?: boolean;
  detailed?: boolean;
}) {
  if (compact) {
    return (
      <Link href={`/post/${event.id}`} className="event-item compact">
        <span className="event-dot" />
        <span className="event-title-compact">{event.title}</span>
      </Link>
    );
  }

  return (
    <Link href={`/post/${event.id}`} className="event-item detailed">
      <div className="event-time">
        {event.eventStartDate && (
          <time>
            {new Date(event.eventStartDate).toLocaleDateString('ja-JP', {
              month: 'short',
              day: 'numeric',
            })}
            {event.eventEndDate && event.eventEndDate !== event.eventStartDate && (
              <>
                {' '}〜{' '}
                {new Date(event.eventEndDate).toLocaleDateString('ja-JP', {
                  month: 'short',
                  day: 'numeric',
                })}
              </>
            )}
          </time>
        )}
      </div>
      <h3 className="event-title">{event.title}</h3>
      {detailed && event.markdown && (
        <p className="event-excerpt">
          {event.markdown.slice(0, 100)}
          {event.markdown.length > 100 && '...'}
        </p>
      )}
    </Link>
  );
}
