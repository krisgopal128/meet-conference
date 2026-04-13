import { cn } from '../../utils/cn';
import { Skeleton } from './Skeletons';
import {
  Video,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

export interface StatItem {
  label: string;
  value: number | string;
  change?: number;
  changeLabel?: string;
  icon: typeof Video;
  color?: 'brand' | 'success' | 'warning' | 'error' | 'info';
}

interface DashboardStatsProps {
  stats: StatItem[];
  loading?: boolean;
}

const colorMap = {
  brand: {
    bg: 'bg-brand-100 dark:bg-brand-900/30',
    icon: 'text-brand-500',
    trend: 'text-brand-500',
  },
  success: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    icon: 'text-success-500',
    trend: 'text-success-500',
  },
  warning: {
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    icon: 'text-warning-500',
    trend: 'text-warning-500',
  },
  error: {
    bg: 'bg-error-100 dark:bg-error-900/30',
    icon: 'text-error-500',
    trend: 'text-error-500',
  },
  info: {
    bg: 'bg-info-100 dark:bg-info-900/30',
    icon: 'text-info-500',
    trend: 'text-info-500',
  },
};

export function DashboardStats({ stats, loading }: DashboardStatsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <StatCard key={index} stat={stat} />
      ))}
    </div>
  );
}

function StatCard({ stat }: { stat: StatItem }) {
  const color = stat.color || 'brand';
  const colors = colorMap[color];
  const Icon = stat.icon;

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div className={cn('rounded-lg p-2', colors.bg)}>
          <Icon className={cn('h-5 w-5', colors.icon)} />
        </div>
        {stat.change !== undefined && (
          <TrendIndicator change={stat.change} label={stat.changeLabel} />
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-surface-900 dark:text-surface-100">
          {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
        </p>
        <p className="text-sm text-surface-500 dark:text-surface-400">{stat.label}</p>
      </div>
    </div>
  );
}

function TrendIndicator({ change, label }: { change: number; label?: string }) {
  if (change === 0) {
    return (
      <div className="flex items-center gap-1 text-surface-400 text-xs">
        <Minus size={12} />
        {label && <span>{label}</span>}
      </div>
    );
  }

  const isPositive = change > 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const colorClass = isPositive ? 'text-success-500' : 'text-error-500';

  return (
    <div className={cn('flex items-center gap-1 text-xs', colorClass)}>
      <Icon size={12} />
      <span>{Math.abs(change)}%</span>
      {label && <span className="text-surface-400">{label}</span>}
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      <Skeleton className="h-9 w-9 rounded-lg mb-3" />
      <Skeleton className="h-7 w-16 mb-1" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

// Default stats for dashboard
export function useDashboardStats() {
  return {
    totalMeetings: 0,
    totalParticipants: 0,
    totalDuration: 0,
    upcomingMeetings: 0,
  };
}
