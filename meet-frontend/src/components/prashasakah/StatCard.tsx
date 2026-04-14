import { cn } from '../../utils/cn';
import { Skeleton } from '../shared/Skeletons';
import {
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  color?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  loading?: boolean;
}

const colorMap = {
  brand: {
    bg: 'bg-brand-100 dark:bg-brand-900/30',
    icon: 'text-brand-500',
  },
  success: {
    bg: 'bg-success-100 dark:bg-success-900/30',
    icon: 'text-success-500',
  },
  warning: {
    bg: 'bg-warning-100 dark:bg-warning-900/30',
    icon: 'text-warning-500',
  },
  danger: {
    bg: 'bg-danger-100 dark:bg-danger-900/30',
    icon: 'text-danger-500',
  },
  info: {
    bg: 'bg-info-100 dark:bg-info-900/30',
    icon: 'text-info-500',
  },
};

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      <Skeleton className="h-9 w-9 rounded-lg mb-3" />
      <Skeleton className="h-7 w-16 mb-1" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = 'brand',
  loading = false,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  const colors = colorMap[color];

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div className={cn('rounded-lg p-2', colors.bg)}>
          <div className={cn('h-6 w-6', colors.icon)}>
            {icon}
          </div>
        </div>
        {trend && (
          <div className={cn('flex items-center gap-1 text-xs', trend.isPositive ? 'text-success-500' : 'text-danger-500')}>
            {trend.value === 0 ? (
              <Minus size={12} />
            ) : trend.isPositive ? (
              <TrendingUp size={12} />
            ) : (
              <TrendingDown size={12} />
            )}
            {trend.value !== 0 && <span>{Math.abs(trend.value)}%</span>}
          </div>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-surface-900 dark:text-surface-100">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-sm text-surface-500 dark:text-surface-400">{title}</p>
        {subtitle && (
          <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

export default StatCard;
