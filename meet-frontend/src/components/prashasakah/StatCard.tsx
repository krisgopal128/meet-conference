import { cn } from '../../utils/cn';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  subtitle?: string;
  trend?: { value: number; isPositive: boolean };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  loading?: boolean;
}

const colorClasses = {
  blue: 'bg-brand-500',
  green: 'bg-success-500',
  yellow: 'bg-warning-500',
  red: 'bg-danger-500',
  purple: 'bg-brand-500',
};

const trendColorClasses = {
  positive: 'text-success-600',
  negative: 'text-danger-600',
};

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="h-4 w-24 bg-surface-200 rounded animate-pulse" />
          <div className="h-8 w-16 bg-surface-200 rounded animate-pulse mt-2" />
          <div className="h-3 w-20 bg-surface-200 rounded animate-pulse mt-2" />
        </div>
        <div className="w-12 h-12 bg-surface-200 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

export function StatCard({
  title,
  value,
  icon,
  subtitle,
  trend,
  color = 'blue',
  loading = false,
}: StatCardProps) {
  if (loading) {
    return <StatCardSkeleton />;
  }

  return (
    <div className="bg-white rounded-xl border border-surface-200 p-5 transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-500 truncate">{title}</p>
          <p className="text-2xl font-bold text-surface-800 mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-surface-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p
              className={cn(
                'text-sm mt-1 flex items-center gap-1',
                trend.isPositive ? trendColorClasses.positive : trendColorClasses.negative
              )}
            >
              {trend.isPositive ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        <div className={cn('p-3 rounded-full text-white flex-shrink-0', colorClasses[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default StatCard;
