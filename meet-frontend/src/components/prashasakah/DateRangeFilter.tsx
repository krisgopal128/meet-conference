/**
 * DateRangeFilter - Filter component for date ranges
 */

import { useState } from 'react';

interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangeFilterProps {
  value?: DateRange;
  onChange: ((range: DateRange) => void) | ((from: string, to: string) => void);
  className?: string;
}

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [localFrom, setLocalFrom] = useState('');
  const [localTo, setLocalTo] = useState('');
  const [fromFocused, setFromFocused] = useState(false);
  const [toFocused, setToFocused] = useState(false);

  const from = value?.from ? value.from.toISOString().split('T')[0] : localFrom;
  const to = value?.to ? value.to.toISOString().split('T')[0] : localTo;

  const fromType = from || fromFocused ? 'date' : 'text';
  const toType = to || toFocused ? 'date' : 'text';

  const handleFromChange = (newValue: string) => {
    if (!value) {
      setLocalFrom(newValue);
    }
    if (value) {
      (onChange as (range: DateRange) => void)({
        from: new Date(newValue),
        to: value.to,
      });
    } else {
      (onChange as (from: string, to: string) => void)(newValue, to);
    }
  };

  const handleToChange = (newValue: string) => {
    if (!value) {
      setLocalTo(newValue);
    }
    if (value) {
      (onChange as (range: DateRange) => void)({
        from: value.from,
        to: new Date(newValue),
      });
    } else {
      (onChange as (from: string, to: string) => void)(from, newValue);
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      <div className="flex-1 min-w-[120px]">
        <input
          type={fromType}
          aria-label="From date"
          placeholder="From date"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          onFocus={() => setFromFocused(true)}
          onBlur={() => setFromFocused(false)}
          className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
        />
      </div>
      <div className="flex-1 min-w-[120px]">
        <input
          type={toType}
          aria-label="To date"
          placeholder="To date"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          onFocus={() => setToFocused(true)}
          onBlur={() => setToFocused(false)}
          className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
        />
      </div>
    </div>
  );
}

export default DateRangeFilter;
