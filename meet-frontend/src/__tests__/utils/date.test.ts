import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatMeetingDate,
  formatMeetingDuration,
  formatDateShort,
  formatTime,
  formatRelativeTime,
} from '../../utils/date';

describe('date utilities', () => {
  beforeEach(() => {
    // Mock current date to a fixed point for consistent testing
    const mockDate = new Date('2024-03-15T10:00:00Z');
    vi.useFakeTimers();
    vi.setSystemTime(mockDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatMeetingDate', () => {
    it('should format today\'s date with "Today at" prefix', () => {
      // Today at 2:30 PM
      const result = formatMeetingDate('2024-03-15T14:30:00Z');
      expect(result).toContain('Today');
      expect(result).toMatch(/\d{1,2}:\d{2}\s*[AP]M/i);
    });

    it('should format tomorrow\'s date with "Tomorrow at" prefix', () => {
      const result = formatMeetingDate('2024-03-16T14:30:00Z');
      expect(result).toContain('Tomorrow');
      expect(result).toMatch(/\d{1,2}:\d{2}\s*[AP]M/i);
    });

    it('should format future dates with day and time', () => {
      const result = formatMeetingDate('2024-03-20T14:30:00Z');
      // Should contain day abbreviation and time
      expect(result).toMatch(/[A-Z][a-z]{2}/); // Day abbreviation like "Wed"
      expect(result).toMatch(/Mar/); // Month
    });

    it('should return original string for invalid dates', () => {
      const invalidDate = 'not-a-date';
      expect(formatMeetingDate(invalidDate)).toBe(invalidDate);
    });

    it('should handle ISO date strings', () => {
      const result = formatMeetingDate('2024-03-15T09:00:00.000Z');
      expect(result).toContain('Today');
    });
  });

  describe('formatMeetingDuration', () => {
    it('should format duration between start and end times', () => {
      const start = '2024-03-15T10:00:00Z';
      const end = '2024-03-15T11:30:00Z';
      
      const result = formatMeetingDuration(start, end);
      expect(result).toMatch(/1\s*hour/);
      expect(result).toMatch(/30\s*minutes/);
    });

    it('should handle short durations', () => {
      const start = '2024-03-15T10:00:00Z';
      const end = '2024-03-15T10:15:00Z';
      
      const result = formatMeetingDuration(start, end);
      expect(result).toMatch(/15\s*minutes/);
    });

    it('should return "In progress" when end is not provided', () => {
      const result = formatMeetingDuration('2024-03-15T10:00:00Z');
      expect(result).toBe('In progress');
    });

    it('should return "Unknown" for invalid dates', () => {
      const result = formatMeetingDuration('invalid', '2024-03-15T10:00:00Z');
      expect(result).toBe('Unknown');
    });

    it('should handle multi-hour meetings', () => {
      const start = '2024-03-15T09:00:00Z';
      const end = '2024-03-15T12:00:00Z';
      
      const result = formatMeetingDuration(start, end);
      expect(result).toMatch(/3\s*hours/);
    });
  });

  describe('formatDateShort', () => {
    it('should format date in short format (MMM d, yyyy)', () => {
      const result = formatDateShort('2024-03-15T10:00:00Z');
      expect(result).toMatch(/Mar/);
      expect(result).toMatch(/15/);
      expect(result).toMatch(/2024/);
    });

    it('should handle different months', () => {
      const result = formatDateShort('2024-12-25T10:00:00Z');
      expect(result).toMatch(/Dec/);
      expect(result).toMatch(/25/);
    });

    it('should return original string for invalid dates', () => {
      const invalidDate = 'invalid-date';
      expect(formatDateShort(invalidDate)).toBe(invalidDate);
    });

    it('should format dates consistently', () => {
      const result1 = formatDateShort('2024-01-01T00:00:00Z');
      const result2 = formatDateShort('2024-06-15T12:00:00Z');
      
      expect(result1).toMatch(/Jan.*1.*2024/);
      expect(result2).toMatch(/Jun.*15.*2024/);
    });
  });

  describe('formatTime', () => {
    it('should format time from ISO string', () => {
      const result = formatTime('2024-03-15T14:30:00Z');
      // Should contain time representation
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle midnight', () => {
      const result = formatTime('2024-03-15T00:00:00Z');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should handle end of day', () => {
      const result = formatTime('2024-03-15T23:59:00Z');
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });

    it('should return original string for invalid dates', () => {
      const invalidTime = 'not-a-time';
      expect(formatTime(invalidTime)).toBe(invalidTime);
    });
  });

  describe('formatRelativeTime', () => {
    it('should format past times with "ago" suffix', () => {
      // 2 hours ago from mocked current time
      const pastTime = '2024-03-15T08:00:00Z';
      const result = formatRelativeTime(pastTime);
      expect(result).toMatch(/ago/i);
    });

    it('should format future times with "in" prefix', () => {
      // 2 hours in the future from mocked current time
      const futureTime = '2024-03-15T12:00:00Z';
      const result = formatRelativeTime(futureTime);
      expect(result).toMatch(/in/i);
    });

    it('should handle very recent times', () => {
      // 5 minutes ago
      const recentTime = '2024-03-15T09:55:00Z';
      const result = formatRelativeTime(recentTime);
      expect(result).toMatch(/minutes?\s*ago/i);
    });

    it('should handle distant future times', () => {
      // 2 days in the future
      const futureTime = '2024-03-17T10:00:00Z';
      const result = formatRelativeTime(futureTime);
      expect(result).toMatch(/in.*days/i);
    });

    it('should return original string for invalid dates', () => {
      const invalidDate = 'invalid-relative';
      expect(formatRelativeTime(invalidDate)).toBe(invalidDate);
    });
  });

  describe('edge cases', () => {
    it('should handle leap year dates', () => {
      const leapDate = '2024-02-29T12:00:00Z';
      expect(() => formatDateShort(leapDate)).not.toThrow();
    });

    it('should handle year boundaries', () => {
      const newYear = '2024-01-01T00:00:00Z';
      const result = formatDateShort(newYear);
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/2024/);
    });

    it('should handle timezone-aware dates', () => {
      const withTimezone = '2024-03-15T10:00:00-05:00';
      expect(() => formatTime(withTimezone)).not.toThrow();
    });
  });
});
