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

  const from = value?.from ? value.from.toISOString().split('T')[0] : localFrom;
  const to = value?.to ? value.to.toISOString().split('T')[0] : localTo;

  const handleFromChange = (newValue: string) => {
    if (!value) {
      setLocalFrom(newValue);
    }
    // Call onChange with appropriate signature
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
    // Call onChange with appropriate signature
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
      <div>
        <label className="block text-xs text-surface-500 mb-1">From</label>
        <input
          type="date"
          aria-label="From date"
          value={from}
          onChange={(e) => handleFromChange(e.target.value)}
          className="px-3 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <div>
        <label className="block text-xs text-surface-500 mb-1">To</label>
        <input
          type="date"
          aria-label="To date"
          value={to}
          onChange={(e) => handleToChange(e.target.value)}
          className="px-3 py-2 border border-surface-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
    </div>
  );
}

export default DateRangeFilter;
