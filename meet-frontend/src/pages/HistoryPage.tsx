import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { PageErrorBoundary } from '../components/shared/PageErrorBoundary';
import { MeetingRowSkeleton } from '../components/shared/Skeletons';
import type { Meeting } from '../types';
import { format, parseISO, intervalToDuration, formatDuration as dateFnsFormatDuration } from 'date-fns';
import { cn } from '../utils/cn';
import { sanitizeUrl } from '../utils/security';
import logger from '../utils/logger';
import {
  Clock,
  Video,
  Users,
  Calendar,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';

type SortField = 'date' | 'duration' | 'participants';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

// Module-scoped pure functions — no state dependency
function calculateDurationMinutes(meeting: Meeting): number {
  if (!meeting.startedAt || !meeting.endedAt) return 0;
  const start = parseISO(meeting.startedAt);
  const end = parseISO(meeting.endedAt);
  return Math.abs(Math.round((end.getTime() - start.getTime()) / 60000));
}

function formatDuration(meeting: Meeting): string {
  if (!meeting.startedAt || !meeting.endedAt) return '—';
  const start = parseISO(meeting.startedAt);
  const end = parseISO(meeting.endedAt);
  const diffMs = Math.abs(end.getTime() - start.getTime());
  if (diffMs < 60000) return '—';
  const duration = intervalToDuration({ start: new Date(0), end: new Date(diffMs) });
  return dateFnsFormatDuration(duration, { format: ['hours', 'minutes'] }) || '< 1 min';
}

function formatMinutes(mins: number): string {
  if (mins < 1) return '< 1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function getMostActiveDay(meetings: Meeting[]): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const counts: Record<string, number> = {};
  meetings.forEach(m => {
    if (m.startedAt) {
      const day = days[new Date(m.startedAt).getDay()];
      counts[day] = (counts[day] || 0) + 1;
    }
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : 'N/A';
}

// Module-scoped SortIcon — stable reference
const SortIcon = memo(function SortIcon({ field, sortField, sortOrder }: { field: SortField; sortField: SortField; sortOrder: SortOrder }) {
  if (sortField !== field) return <ArrowUpDown size={14} className="text-surface-400" />;
  return sortOrder === 'asc'
    ? <ArrowUp size={14} className="text-brand-500" />
    : <ArrowDown size={14} className="text-brand-500" />;
});

export default function HistoryPage() {
  return (
    <PageErrorBoundary fallbackMessage="Failed to load meeting history.">
      <HistoryPageContent />
    </PageErrorBoundary>
  );
}

function HistoryPageContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize from URL params
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialPageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const initialSearch = searchParams.get('search') || '';
  const initialSortField = (searchParams.get('sortField') as SortField) || 'date';
  const initialSortOrder = (searchParams.get('sortOrder') as SortOrder) || 'desc';

  const [allMeetings, setAllMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [debouncedSearch, setDebouncedSearch] = useState(initialSearch);
  const [sortField, setSortField] = useState<SortField>(initialSortField);
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSortOrder);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState<{ start?: string; end?: string }>({});
  const [activeQuickFilter, setActiveQuickFilter] = useState<string | null>(null);
  // Error state removed — using toast.error for user feedback
  const mountedRef = useRef(true);

  // Update URL params when state changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (pageSize !== 20) params.set('pageSize', pageSize.toString());
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (sortField !== 'date') params.set('sortField', sortField);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    setSearchParams(params, { replace: true });
  }, [currentPage, pageSize, debouncedSearch, sortField, sortOrder, setSearchParams]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to first page on search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    mountedRef.current = true;
    loadMeetings();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Refresh data when user returns to the tab
  useEffect(() => {
    const handleFocus = () => {
      if (mountedRef.current) loadMeetings();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      // setError removed: // (null);
      const response = await meetingsApi.getHistory(1000, 0);
      if (!mountedRef.current) return;
      // Normalize field names
      const normalized = (response?.data?.meetings || []).map(m => ({
        ...m,
        roomName: m.roomName || m.room_name || '',
        roomTitle: m.roomTitle ?? m.room_title ?? null,
        participantCount: m.participantCount ?? m.participant_count ?? m.uniqueParticipants ?? m.unique_participants ?? 0,
        startedAt: m.startedAt || m.started_at || '',
        endedAt: m.endedAt || m.ended_at,
        recordingUrl: m.recordingUrl || m.recording_url,
      }));
      setAllMeetings(normalized);
    } catch (err) {
      if (!mountedRef.current) return;
      logger.error('Failed to load meetings:', err);
      setAllMeetings([]);
      // setError removed: // ('Failed to load meeting history. Please try again later.');
      toast.error('Failed to load meeting history');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };


  // Filter meetings
  const filteredMeetings = useMemo(() => {
    return allMeetings.filter(meeting => {
      // Search filter
      if (debouncedSearch) {
        const search = debouncedSearch.toLowerCase();
        const title = (meeting.roomTitle || meeting.roomName || '').toLowerCase();
        const roomName = (meeting.roomName || '').toLowerCase();
        if (!title.includes(search) && !roomName.includes(search)) {
          return false;
        }
      }

      // Date filter
      if (dateFilter.start || dateFilter.end) {
        const meetingDate = meeting.startedAt ? parseISO(meeting.startedAt) : null;
        if (!meetingDate) return false;
        if (dateFilter.start && meetingDate < parseISO(dateFilter.start)) return false;
        if (dateFilter.end && meetingDate > parseISO(dateFilter.end + 'T23:59:59')) return false;
      }

      return true;
    });
  }, [allMeetings, debouncedSearch, dateFilter]);

  // Sort meetings
  const sortedMeetings = useMemo(() => {
    return [...filteredMeetings].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date': {
          const aDate = a.startedAt ? new Date(a.startedAt).getTime() : 0;
          const bDate = b.startedAt ? new Date(b.startedAt).getTime() : 0;
          comparison = aDate - bDate;
          break;
        }
        case 'duration': {
          const aDuration = calculateDurationMinutes(a);
          const bDuration = calculateDurationMinutes(b);
          comparison = aDuration - bDuration;
          break;
        }
        case 'participants': {
          comparison = (a.uniqueParticipants || a.participantCount || 0) - 
                       (b.uniqueParticipants || b.participantCount || 0);
          break;
        }
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredMeetings, sortField, sortOrder]);

  // Paginate meetings
  const paginatedMeetings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedMeetings.slice(start, start + pageSize);
  }, [sortedMeetings, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedMeetings.length / pageSize);

  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setDateFilter({});
    setActiveQuickFilter(null);
    setCurrentPage(1);
  }, []);

  const handleQuickDateFilter = useCallback((period: string) => {
    const now = new Date();
    let start: Date | undefined;

    if (period === 'Today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'This Week') {
      start = new Date(now);
      start.setDate(start.getDate() - start.getDay());
      start.setHours(0, 0, 0, 0);
    } else if (period === 'This Month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      setDateFilter({});
      setActiveQuickFilter('All Time');
      setCurrentPage(1);
      return;
    }

    setDateFilter({
      start: start.toISOString().split('T')[0],
      end: now.toISOString().split('T')[0],
    });
    setActiveQuickFilter(period);
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = debouncedSearch || dateFilter.start || dateFilter.end;

  // Memoize most active day computation
  const mostActiveDay = useMemo(() => getMostActiveDay(allMeetings), [allMeetings]);

  // Stats for dashboard
  const stats = useMemo(() => ({
    totalMeetings: allMeetings.length,
    totalParticipants: allMeetings.reduce((sum, m) => sum + (m.uniqueParticipants || m.participantCount || 0), 0),
    totalDuration: allMeetings.reduce((sum, m) => sum + calculateDurationMinutes(m), 0),
    thisMonth: allMeetings.filter(m => {
      if (!m.startedAt) return false;
      const date = parseISO(m.startedAt);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
  }), [allMeetings]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-white">
            Meeting History
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            View and manage all your past meetings, participants, and recordings.
            {stats.totalMeetings > 0 && (
              <span className="ml-2 text-xs bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 px-2 py-0.5 rounded-full">
                {stats.totalMeetings} meetings
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Meetings" 
          value={stats.totalMeetings} 
          icon={Video}
          color="brand"
          primary
        />
        <StatCard 
          label="This Month" 
          value={stats.thisMonth} 
          icon={Calendar}
          color="success"
        />
        <StatCard 
          label="Total Participants" 
          value={stats.totalParticipants} 
          icon={Users}
          color="info"
        />
        <StatCard 
          label="Total Hours" 
          value={Math.max(0, Math.round(stats.totalDuration / 60))} 
          icon={Clock}
          color="warning"
        />
      </div>

      {/* Quick Insights */}
      {allMeetings.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-surface-500 dark:text-surface-400 px-1">
          <span>📊 Avg duration: <strong className="text-surface-700 dark:text-surface-200">{formatMinutes(stats.totalDuration / stats.totalMeetings)}</strong></span>
          <span>👥 Avg participants: <strong className="text-surface-700 dark:text-surface-200">{(stats.totalParticipants / stats.totalMeetings).toFixed(1)}</strong></span>
          <span>📅 Most active: <strong className="text-surface-700 dark:text-surface-200">{mostActiveDay}</strong></span>
        </div>
      )}

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input aria-label="Search by title or room code"
              type="text"
              placeholder="Search by title or room code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10 pr-10"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 p-1"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              "btn-secondary flex items-center gap-2",
              showFilters && "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400"
            )}
          >
            <Filter size={18} />
            <span>Filters</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-brand-500" />
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
            {/* Quick Date Filter Pills */}
            <div className="flex flex-wrap gap-2 mb-3">
              {['Today', 'This Week', 'This Month', 'All Time'].map(period => (
                <button
                  key={period}
                  onClick={() => handleQuickDateFilter(period)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-full border transition-colors",
                    activeQuickFilter === period
                      ? "bg-brand-500 text-white border-brand-500"
                      : "border-surface-300 dark:border-surface-600 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800"
                  )}
                >
                  {period}
                </button>
              ))}
            </div>

            {/* Custom date range indicator */}
            {(dateFilter.start || dateFilter.end) && !activeQuickFilter && (
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-surface-500">Custom range:</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-xs">
                  {dateFilter.start} — {dateFilter.end || 'now'}
                  <button onClick={() => { setDateFilter({}); setActiveQuickFilter(null); }}>
                    <X size={12} />
                  </button>
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-1 block">
                  Start Date
                </label>
                <input aria-label="Date"
                  type="date"
                  value={dateFilter.start || ''}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, start: e.target.value }))}
                  className="input"
                />
              </div>
              <div className="flex-1">
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-1 block">
                  End Date
                </label>
                <input aria-label="Date"
                  type="date"
                  value={dateFilter.end || ''}
                  onChange={(e) => setDateFilter(prev => ({ ...prev, end: e.target.value }))}
                  className="input"
                />
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <button
                    onClick={clearFilters}
                    className="btn-ghost text-sm"
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-surface-500 dark:text-surface-400">
          Showing {paginatedMeetings.length} of {sortedMeetings.length} meeting(s)
          {hasActiveFilters && ` (filtered from ${allMeetings.length})`}
        </p>
        <select aria-label="Filter"
          value={pageSize}
          onChange={(e) => handlePageSizeChange(parseInt(e.target.value, 10))}
          className="input text-sm py-2 px-3 w-auto"
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size} per page</option>
          ))}
        </select>
      </div>

      {/* Table - Desktop, Card List - Mobile */}
      {loading ? (
        <div className="card overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500">Meeting</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500">Date</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500">Duration</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500">Participants</th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500">Recording</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <MeetingRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile loading skeletons */}
          <div className="md:hidden divide-y divide-surface-200 dark:divide-surface-700">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="skeleton-text w-48 h-5 mb-2" />
                <div className="skeleton-text w-32 h-4" />
              </div>
            ))}
          </div>
        </div>
      ) : sortedMeetings.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-surface-100 dark:bg-surface-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={28} className="text-surface-400" aria-hidden="true" />
          </div>
          <h2 className="font-display text-lg font-semibold text-surface-800 dark:text-white mb-2">
            {hasActiveFilters ? 'No meetings match your filters' : 'No meeting history'}
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6 max-w-sm mx-auto">
            {hasActiveFilters 
              ? 'Try adjusting your search or filters'
              : 'Your past meetings will appear here'}
          </p>
          {hasActiveFilters ? (
            <button onClick={clearFilters} className="btn-secondary">
              Clear Filters
            </button>
          ) : (
            <Link to="/" className="btn-primary">
              <Video size={18} className="mr-2" />
              Start a Meeting
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="card overflow-hidden hidden md:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-300">
                    Meeting
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-300 cursor-pointer hover:text-surface-700 dark:hover:text-surface-200"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5">
                      Date & Time
                      <SortIcon field="date" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-300 cursor-pointer hover:text-surface-700 dark:hover:text-surface-200"
                    onClick={() => handleSort('duration')}
                  >
                    <div className="flex items-center gap-1.5">
                      Duration
                      <SortIcon field="duration" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-300 cursor-pointer hover:text-surface-700 dark:hover:text-surface-200"
                    onClick={() => handleSort('participants')}
                  >
                    <div className="flex items-center gap-1.5">
                      Participants
                      <SortIcon field="participants" sortField={sortField} sortOrder={sortOrder} />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-300">
                    Recording
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-surface-600 dark:text-surface-300">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {paginatedMeetings.map((meeting, index) => (
                  <tr 
                    key={meeting.id} 
                    className={cn(
                      "hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors",
                      index % 2 === 0 ? "bg-white dark:bg-surface-900" : "bg-surface-50/50 dark:bg-surface-800/30"
                    )}
                  >
                    <td className="px-4 py-3">
                      <Link 
                        to={`/history/${meeting.id}`}
                        className="block hover:text-brand-500"
                      >
                        <p className="font-medium text-surface-800 dark:text-white truncate max-w-[200px]">
                          {meeting.roomTitle || 'Untitled Meeting'}
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400 font-mono">
                          {meeting.roomName}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {meeting.startedAt && (
                        <span>{format(parseISO(meeting.startedAt), 'MMM d, yyyy • h:mm a')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {formatDuration(meeting)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1.5">
                          {Array.from({ length: Math.min(3, meeting.uniqueParticipants || meeting.participantCount || 0) }).map((_, i) => (
                            <div 
                              key={i} 
                              className="w-6 h-6 rounded-full border-2 border-white dark:border-surface-900 flex items-center justify-center text-[10px] font-medium text-white"
                              style={{ backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                            >
                              {(meeting.uniqueParticipants || meeting.participantCount || 0) > 3 && i === 2 
                                ? `+${(meeting.uniqueParticipants || meeting.participantCount || 0) - 2}` 
                                : ''}
                            </div>
                          ))}
                        </div>
                        <span className="text-sm text-surface-600 dark:text-surface-300">
                          {meeting.uniqueParticipants || meeting.participantCount || 0}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {meeting.recordingUrl && sanitizeUrl(meeting.recordingUrl) ? (
                        <a
                          href={sanitizeUrl(meeting.recordingUrl) ?? undefined}
                          target="_blank" rel="noreferrer noopener"
                          className="text-brand-500 hover:text-brand-600 inline-flex items-center gap-1.5"
                        >
                          <span className="inline-flex items-center gap-1.5 text-red-500">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                            Available
                          </span>
                        </a>
                      ) : (
                        <span className="text-surface-300 dark:text-surface-600 text-xs">No recording</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/history/${meeting.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors"
                      >
                        View Details
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {paginatedMeetings.map((meeting) => (
              <Link
                key={meeting.id}
                to={`/history/${meeting.id}`}
                className="card p-4 block hover:bg-surface-50 dark:hover:bg-surface-800/50 transition"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-surface-800 dark:text-white truncate">
                      {meeting.roomTitle || 'Untitled Meeting'}
                    </p>
                    <p className="text-xs text-surface-400 font-mono mt-0.5">
                      {meeting.roomName}
                    </p>
                  </div>
                  <ArrowRight size={16} className="text-surface-400 shrink-0 mt-1" />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-sm text-surface-500 dark:text-surface-400">
                  {meeting.startedAt && (
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {format(parseISO(meeting.startedAt), 'MMM d, yyyy • h:mm a')}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Users size={12} />
                    {meeting.uniqueParticipants || meeting.participantCount || 0}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs">
                  <span className="text-surface-500 dark:text-surface-400">
                    {formatDuration(meeting)}
                  </span>
                  {meeting.recordingUrl && sanitizeUrl(meeting.recordingUrl) && (
                    <span className="flex items-center gap-1 text-brand-500">
                      <ExternalLink size={12} />
                      Recording
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="space-y-3">
              <p className="text-sm text-surface-500 dark:text-surface-400 text-center">
                Page {currentPage} of {totalPages} • Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedMeetings.length)} of {sortedMeetings.length} meetings
              </p>
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="btn-ghost min-w-[44px] min-h-[44px] border border-surface-200 dark:border-surface-700 disabled:opacity-40"
                >
                  <ChevronLeft size={18} />
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let page: number;
                  if (totalPages <= 5) {
                    page = i + 1;
                  } else if (currentPage <= 3) {
                    page = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    page = totalPages - 4 + i;
                  } else {
                    page = currentPage - 2 + i;
                  }
                  
                  return (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={cn(
                        "min-w-[44px] min-h-[44px] rounded-lg border font-medium text-sm transition-colors",
                        currentPage === page
                          ? "bg-brand-500 text-white border-brand-500"
                          : "border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-800"
                      )}
                    >
                      {page}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-ghost min-w-[44px] min-h-[44px] border border-surface-200 dark:border-surface-700 disabled:opacity-40"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Stat card component
function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color,
  primary = false
}: { 
  label: string; 
  value: number; 
  icon: typeof Video;
  color: 'brand' | 'success' | 'warning' | 'info';
  primary?: boolean;
}) {
  const colorClasses = {
    brand: 'bg-brand-100 dark:bg-brand-900/30 text-brand-500',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-500',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-500',
    info: 'bg-info-100 dark:bg-info-900/30 text-info-500',
  };

  return (
    <div className={cn(
      "card p-4",
      primary && "ring-1 ring-brand-200 dark:ring-brand-800 bg-gradient-to-br from-brand-50/50 to-white dark:from-brand-900/10 dark:to-surface-900"
    )}>
      <div className="flex items-start justify-between">
        <div className={cn('rounded-lg p-2', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        <p className={cn(
          "font-semibold text-surface-900 dark:text-surface-100",
          primary ? "text-3xl font-bold" : "text-2xl"
        )}>
          {value.toLocaleString()}
        </p>
        <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
      </div>
    </div>
  );
}
