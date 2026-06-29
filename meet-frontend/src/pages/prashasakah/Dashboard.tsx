import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { useUser } from '../../store/authStore';
import { prashasakahApi, AdminStats, BandwidthStats, PeakUsersStats } from '../../services/prashasakahApi';
import { StatCard, StatCardSkeleton } from '../../components/prashasakah/StatCard';
import { DateRangeFilter } from '../../components/prashasakah/DateRangeFilter';
import { BandwidthChartSkeleton } from '../../components/prashasakah/BandwidthChartSkeleton';
import { PeakUsersChartSkeleton } from '../../components/prashasakah/PeakUsersChartSkeleton';
import logger from '../../utils/logger';

/** Lazy-loaded chart components — heavy chart code is not included in the initial bundle */
const BandwidthChart = lazy(() => import('../../components/prashasakah/BandwidthChart').then(m => ({ default: m.BandwidthChart })));
const PeakUsersChart = lazy(() => import('../../components/prashasakah/PeakUsersChart').then(m => ({ default: m.PeakUsersChart })));

/**
 * Dashboard - Admin Dashboard Page
 * 
 * Displays key metrics, charts, and quick stats.
 */

interface DateRange {
  from: Date;
  to: Date;
}

// Icons
const UsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 016-6h6a6 6 0 016 6v1m-6-13a4 4 0 110-8 4 4 0 010 8z" />
  </svg>
);

const ActiveUsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const GuestUsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const OngoingMeetingsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
  </svg>
);

const TotalMeetingsIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const PeakUsersIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);

const RefreshIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

export function Dashboard() {
  const user = useUser();
  
  // State for date range
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  /** Debounced date range — only updates 400ms after the user stops changing dates,
   *  preventing rapid API calls while picking dates. */
  const [debouncedRange, setDebouncedRange] = useState<DateRange>(dateRange);
  const dateDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    dateDebounceRef.current = setTimeout(() => setDebouncedRange(range), 400);
  }, []);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (dateDebounceRef.current) clearTimeout(dateDebounceRef.current);
    };
  }, []);

  // State for stats data
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [bandwidthData, setBandwidthData] = useState<BandwidthStats | null>(null);
  const [peakUsersData, setPeakUsersData] = useState<PeakUsersStats | null>(null);

  // Loading states
  const [statsLoading, setStatsLoading] = useState(true);
  const [bandwidthLoading, setBandwidthLoading] = useState(true);
  const [peakUsersLoading, setPeakUsersLoading] = useState(true);

  // Error states
  const [statsError, setStatsError] = useState<string | null>(null);
  const [bandwidthError, setBandwidthError] = useState<string | null>(null);
  const [peakUsersError, setPeakUsersError] = useState<string | null>(null);

  // Auto-refresh interval
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Track mount status to prevent state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Fetch stats data
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);

    try {
      const params = {
        from: debouncedRange.from.toISOString(),
        to: debouncedRange.to.toISOString(),
      };
      const response = await prashasakahApi.getStatsDetailed(params);
      if (mountedRef.current) {
        // Backend returns stats directly in response.data
        setStats(response?.data || null);
      }
    } catch (error) {
      if (mountedRef.current) {
        logger.error('Failed to fetch stats:', error);
        setStatsError('Failed to load statistics. Please try again.');
      }
    } finally {
      if (mountedRef.current) {
        setStatsLoading(false);
      }
    }
  }, [debouncedRange]);

  // Fetch bandwidth data
  const fetchBandwidth = useCallback(async () => {
    setBandwidthLoading(true);
    setBandwidthError(null);

    try {
      const days = Math.ceil((debouncedRange.to.getTime() - debouncedRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const response = await prashasakahApi.getBandwidthStats(days);
      if (mountedRef.current) {
        setBandwidthData(response.data);
      }
    } catch (error) {
      if (mountedRef.current) {
        logger.error('Failed to fetch bandwidth:', error);
        setBandwidthError('Failed to load bandwidth data.');
      }
    } finally {
      if (mountedRef.current) {
        setBandwidthLoading(false);
      }
    }
  }, [debouncedRange]);

  // Fetch peak users data
  const fetchPeakUsers = useCallback(async () => {
    setPeakUsersLoading(true);
    setPeakUsersError(null);

    try {
      const days = Math.ceil((debouncedRange.to.getTime() - debouncedRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const response = await prashasakahApi.getPeakUsersStats(days);
      if (mountedRef.current) {
        setPeakUsersData(response.data);
      }
    } catch (error) {
      if (mountedRef.current) {
        logger.error('Failed to fetch peak users:', error);
        setPeakUsersError('Failed to load peak users data.');
      }
    } finally {
      if (mountedRef.current) {
        setPeakUsersLoading(false);
      }
    }
  }, [debouncedRange]);

  // Fetch all data
  const fetchAllData = useCallback(() => {
    fetchStats();
    fetchBandwidth();
    fetchPeakUsers();
  }, [fetchStats, fetchBandwidth, fetchPeakUsers]);

  // Initial fetch and when date range changes
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchAllData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllData]);

  // Format number with commas
  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Header with Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800 dark:text-white">Dashboard</h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            Welcome back, {user?.name || 'Admin'}! Here's an overview of your conference platform.
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          {/* Auto-refresh toggle */}
          <label className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 cursor-pointer">
            <input aria-label="Toggle"
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-surface-300 text-brand-600 focus:ring-brand-400"
            />
            Auto-refresh
          </label>
          
          {/* Refresh button */}
          <button
            onClick={fetchAllData}
            disabled={statsLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshIcon />
            Refresh
          </button>
          
          {/* Date range filter */}
          <DateRangeFilter
            value={dateRange}
            onChange={handleDateRangeChange}
          />
        </div>
      </div>

      {/* Error Banner */}
      {(statsError || bandwidthError || peakUsersError) && (
          <div className="bg-danger-50 border border-danger-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-danger-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-sm font-medium text-danger-800">Error Loading Data</h2>
              <p className="text-sm text-danger-600 mt-1">
                {statsError || bandwidthError || peakUsersError}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-5">
        {statsLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : stats ? (
          <>
            <StatCard
              title="Total Users"
              value={formatNumber(stats.users?.total || 0)}
              color="brand"
              icon={<UsersIcon />}
              subtitle="All registered users"
            />
            <StatCard
              title="Active Users"
              value={formatNumber(stats.users?.active || 0)}
              color="success"
              icon={<ActiveUsersIcon />}
              subtitle="Not banned"
            />
            <StatCard
              title="Guest Users"
              value={formatNumber(stats.users?.guests || 0)}
              color="warning"
              icon={<GuestUsersIcon />}
              subtitle="In meetings now"
            />
            <StatCard
              title="Ongoing Meetings"
              value={formatNumber(stats.meetings?.ongoing || 0)}
              color="info"
              icon={<OngoingMeetingsIcon />}
              subtitle="In progress now"
            />
            <StatCard
              title="Total Meetings"
              value={formatNumber(stats.meetings?.total || 0)}
              color="brand"
              icon={<TotalMeetingsIcon />}
              subtitle="All time"
            />
            <StatCard
              title="Peak Concurrent"
              value={formatNumber(stats.peakConcurrentUsers || 0)}
              color="danger"
              icon={<PeakUsersIcon />}
              subtitle="Max simultaneous"
            />
          </>
        ) : null}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bandwidth Chart */}
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-700 dark:text-surface-200">Bandwidth Usage</h2>
            {bandwidthLoading && (
              <span className="text-xs text-surface-400 dark:text-surface-500 animate-pulse">Loading...</span>
            )}
          </div>
          {bandwidthError ? (
            <div className="h-64 flex items-center justify-center bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <p className="text-surface-500 dark:text-surface-400">{bandwidthError}</p>
            </div>
          ) : bandwidthData?.data && bandwidthData.data.length > 0 ? (
            <Suspense fallback={<BandwidthChartSkeleton height={256} />}>
              <BandwidthChart
                data={bandwidthData?.data}
                loading={bandwidthLoading}
                height={256}
              />
            </Suspense>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <svg className="w-10 h-10 text-surface-300 dark:text-surface-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm text-surface-400 dark:text-surface-500">No bandwidth data yet</p>
            </div>
          )}
        </div>

        {/* Peak Users Chart */}
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-surface-700 dark:text-surface-200">Peak Users Over Time</h2>
            {peakUsersLoading && (
              <span className="text-xs text-surface-400 dark:text-surface-500 animate-pulse">Loading...</span>
            )}
          </div>
          {peakUsersError ? (
            <div className="h-64 flex items-center justify-center bg-surface-50 dark:bg-surface-800 rounded-lg border border-surface-200 dark:border-surface-700">
              <p className="text-surface-500 dark:text-surface-400">{peakUsersError}</p>
            </div>
          ) : (
            <Suspense fallback={<PeakUsersChartSkeleton height={256} />}>
              <PeakUsersChart
                data={peakUsersData?.data}
                loading={peakUsersLoading}
                height={256}
              />
            </Suspense>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      {!statsLoading && stats && (
        <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-5">
          <h2 className="text-sm font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-4">Quick Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center md:text-left">
              <p className="text-xs text-surface-400 dark:text-surface-500">Active Rate</p>
              <p className="text-2xl font-bold text-surface-800 dark:text-white mt-0.5">
                {stats.users?.total > 0 
                  ? Math.round((stats.users?.active / stats.users?.total) * 100) 
                  : 0}%
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs text-surface-400 dark:text-surface-500">Meetings per User</p>
              <p className="text-2xl font-bold text-surface-800 dark:text-white mt-0.5">
                {stats.users?.total > 0 
                  ? (stats.meetings?.total / stats.users?.total).toFixed(1) 
                  : '0.0'}
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs text-surface-400 dark:text-surface-500">Peak Ratio</p>
              <p className="text-2xl font-bold text-surface-800 dark:text-white mt-0.5">
                {stats.meetings?.total > 0 
                  ? Math.round(stats.peakConcurrentUsers / stats.meetings?.total) 
                  : 0}
              </p>
            </div>
            <div className="text-center md:text-left">
              <p className="text-xs text-surface-400 dark:text-surface-500">Guest Ratio</p>
              <p className="text-2xl font-bold text-surface-800 dark:text-white mt-0.5">
                {stats.users?.total > 0 
                  ? Math.round((stats.users?.guests / stats.users?.total) * 100) 
                  : 0}%
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
