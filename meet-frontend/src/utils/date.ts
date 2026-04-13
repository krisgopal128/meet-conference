import { 
  format, 
  formatDistanceToNow,
  formatDuration,
  intervalToDuration,
  isToday,
  isTomorrow,
  parseISO,
  isValid
} from 'date-fns';

// Format meeting date with relative time for nearby dates
export function formatMeetingDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    
    if (isToday(date)) {
      return `Today at ${format(date, 'p')}`;
    }
    if (isTomorrow(date)) {
      return `Tomorrow at ${format(date, 'p')}`;
    }
    
    return format(date, 'EEE, MMM d • p');
  } catch {
    return dateStr;
  }
}

// Format meeting duration
export function formatMeetingDuration(startStr: string, endStr?: string): string {
  if (!endStr) return 'In progress';
  
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    
    if (!isValid(start) || !isValid(end)) return 'Unknown';
    
    const duration = intervalToDuration({ start, end });
    return formatDuration(duration, { format: ['hours', 'minutes'] });
  } catch {
    return 'Unknown';
  }
}

// Format date for display (short format)
export function formatDateShort(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

// Format time for display
export function formatTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return format(date, 'p');
  } catch {
    return dateStr;
  }
}

// Relative time (e.g., "2 hours ago", "in 3 days")
export function formatRelativeTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (!isValid(date)) return dateStr;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}
