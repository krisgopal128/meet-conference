import { useMemo } from 'react';

interface BandwidthDataPoint {
  date: string;
  bytes: number;
  meetings: number;
}

interface BandwidthChartProps {
  data?: BandwidthDataPoint[];
  loading?: boolean;
  height?: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function BandwidthChartSkeleton({ height = 256 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-full flex items-end gap-2 px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div className="bg-surface-200 rounded-t flex-1" style={{ height: `${Math.random() * 60 + 40}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BandwidthChart({ data, loading = false, height = 256 }: BandwidthChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((point) => ({
      ...point,
      label: formatDateLabel(point.date),
    }));
  }, [data]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 1;
    return Math.max(...chartData.map((d) => d.bytes));
  }, [chartData]);

  if (loading) {
    return <BandwidthChartSkeleton height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-surface-50 rounded-lg border-2 border-dashed border-surface-200"
        style={{ height }}
      >
        <div className="text-center text-surface-500">
          <svg className="w-12 h-12 mx-auto mb-2 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p>No bandwidth data available</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-brand-500" />
          <span className="text-xs text-surface-500">Bandwidth</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[calc(100%-2rem)] flex flex-col">
        {/* Y-axis labels */}
        <div className="flex-1 flex">
          <div className="w-12 flex flex-col justify-between text-xs text-surface-400 py-1">
            <span>{formatBytes(maxValue)}</span>
            <span>{formatBytes(maxValue / 2)}</span>
            <span>0</span>
          </div>
          
          {/* Bars */}
          <div className="flex-1 flex items-end gap-2">
            {chartData.map((point, index) => {
              const barHeight = (point.bytes / maxValue) * 100;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-1 group">
                  <div className="w-full flex gap-0.5 items-end" style={{ height: 'calc(100% - 20px)' }}>
                    {/* Bandwidth bar */}
                    <div
                      className="flex-1 bg-brand-500 rounded-t transition-all group-hover:bg-brand-600 relative"
                      style={{ height: `${barHeight}%` }}
                    >
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-surface-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {formatBytes(point.bytes)} ({point.meetings} meetings)
                      </div>
                    </div>
                  </div>
                  {/* X-axis label */}
                  <span className="text-xs text-surface-500 truncate w-full text-center">
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BandwidthChart;
