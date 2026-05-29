import { useMemo } from 'react';
import { PeakUsersChartSkeleton } from './PeakUsersChartSkeleton';

interface PeakUsersDataPoint {
  date: string;
  peak: number;
  average: number;
}

interface PeakUsersChartProps {
  data?: PeakUsersDataPoint[];
  loading?: boolean;
  height?: number;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PeakUsersChart({ data, loading = false, height = 256 }: PeakUsersChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((point) => ({
      ...point,
      label: formatDateLabel(point.date),
    }));
  }, [data]);

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 10;
    return Math.max(...chartData.map((d) => d.peak), 10);
  }, [chartData]);

  if (loading) {
    return <PeakUsersChartSkeleton height={height} />;
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-surface-50 rounded-lg border-2 border-dashed border-surface-200"
        style={{ height }}
      >
        <div className="text-center text-surface-500">
          <svg className="w-12 h-12 mx-auto mb-2 text-surface-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <p>No peak users data available</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height }}>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-brand-500" />
          <span className="text-xs text-surface-500">Peak Users</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-brand-400" />
          <span className="text-xs text-surface-500">Average</span>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[calc(100%-2rem)] flex flex-col">
        {/* Y-axis labels + Chart */}
        <div className="flex-1 flex">
          <div className="w-12 flex flex-col justify-between text-xs text-surface-400 py-1">
            <span>{maxValue}</span>
            <span>{Math.round(maxValue / 2)}</span>
            <span>0</span>
          </div>
          
          {/* Line/Area Chart */}
          <div className="flex-1 relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-surface-100" />
              <div className="border-b border-surface-100" />
              <div className="border-b border-surface-100" />
            </div>
            
            {/* Bars for peak */}
            <div className="absolute inset-0 flex items-end gap-2 px-1">
              {chartData.map((point, index) => {
                const barHeight = (point.peak / maxValue) * 100;
                const avgHeight = (point.average / maxValue) * 100;
                
                return (
                  <div key={index} className="flex-1 flex flex-col items-center group relative">
                    {/* Peak bar */}
                    <div 
                      className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t transition-all group-hover:from-purple-700 group-hover:to-purple-500"
                      style={{ height: `${barHeight}%` }}
                    />
                    
                    {/* Average line indicator */}
                    <div 
                      className="absolute left-0 right-0 h-0.5 bg-brand-400 opacity-60"
                      style={{ bottom: `${avgHeight}%` }}
                    />
                    
                    {/* Tooltip */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-surface-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap">
                      Peak: {point.peak} | Avg: {point.average}
                    </div>
                    
                    {/* X-axis label */}
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs text-surface-500 whitespace-nowrap">
                      {point.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* X-axis spacing */}
        <div className="h-6" />
      </div>
    </div>
  );
}

export default PeakUsersChart;
