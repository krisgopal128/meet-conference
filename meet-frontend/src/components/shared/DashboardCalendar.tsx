import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Video } from 'lucide-react';
import { cn } from '../../utils/cn';
import { Skeleton } from './Skeletons';
import type { ScheduledMeeting } from '../../types';

interface DashboardCalendarProps {
  meetings: ScheduledMeeting[];
  loading?: boolean;
  onMeetingClick?: (meeting: ScheduledMeeting) => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getMeetingDate(m: ScheduledMeeting): Date | null {
  const raw = m.scheduledStart || m.scheduled_start;
  if (!raw) return null;
  try {
    return parseISO(raw);
  } catch {
    return null;
  }
}

export function DashboardCalendar({ meetings, loading, onMeetingClick }: DashboardCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const days = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [currentMonth]);

  // Map dates to meetings
  const meetingsByDate = useMemo(() => {
    const map = new Map<string, ScheduledMeeting[]>();
    for (const m of meetings) {
      const d = getMeetingDate(m);
      if (!d) continue;
      const key = format(d, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return map;
  }, [meetings]);

  const selectedKey = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  const selectedMeetings = selectedKey ? (meetingsByDate.get(selectedKey) || []) : [];

  if (loading) return <CalendarSkeleton />;

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition"
          aria-label="Previous month"
        >
          <ChevronLeft size={16} className="text-surface-500" />
        </button>
        <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 transition"
          aria-label="Next month"
        >
          <ChevronRight size={16} className="text-surface-500" />
        </button>
      </div>

      {/* Day names */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_NAMES.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-surface-400 dark:text-surface-500 py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayMeetings = meetingsByDate.get(key) || [];
          const inMonth = isSameMonth(day, currentMonth);
          const today = isToday(day);
          const selected = selectedDate ? isSameDay(day, selectedDate) : false;

          return (
            <button
              key={i}
              onClick={() => setSelectedDate(day)}
              className={cn(
                'relative flex flex-col items-center justify-center py-1.5 text-xs rounded-lg transition',
                !inMonth && 'text-surface-300 dark:text-surface-600',
                inMonth && !today && 'text-surface-700 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700/50',
                today && 'font-bold text-white',
                selected && !today && 'bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-7 h-7 rounded-full',
                  today && 'bg-brand-500 text-white',
                )}
              >
                {format(day, 'd')}
              </span>
              {dayMeetings.length > 0 && (
                <span className={cn(
                  'mt-0.5 h-1 w-1 rounded-full',
                  today ? 'bg-white/70' : 'bg-brand-400'
                )} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date meetings */}
      {selectedDate && selectedMeetings.length > 0 && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
          <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">
            {format(selectedDate, 'EEEE, MMM d')} — {selectedMeetings.length} meeting{selectedMeetings.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1.5">
            {selectedMeetings.map((m) => {
              const d = getMeetingDate(m);
              return (
                <button
                  key={m.id}
                  onClick={() => onMeetingClick?.(m)}
                  className="flex items-center gap-2 w-full text-left p-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition group"
                >
                  <Video size={12} className="text-brand-500 shrink-0" />
                  <span className="text-xs font-medium text-surface-700 dark:text-surface-300 truncate flex-1">
                    {m.title}
                  </span>
                  {d && (
                    <span className="text-[10px] text-surface-400 shrink-0">
                      {format(d, 'h:mm a')}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-6 rounded" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-6 w-6 rounded" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 35 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
