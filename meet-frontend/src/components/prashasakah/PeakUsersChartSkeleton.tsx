export function PeakUsersChartSkeleton({ height = 256 }: { height?: number }) {
  return (
    <div className="animate-pulse" style={{ height }}>
      <div className="h-full flex items-end gap-2 px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 bg-surface-200 dark:bg-surface-700 rounded" style={{ height: `${40 + (i * 17) % 40}%` }} />
        ))}
      </div>
    </div>
  );
}
