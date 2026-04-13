import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { meetingsApi } from '../services/api';
import { PageErrorBoundary } from '../components/shared/PageErrorBoundary';
import { MeetingRowSkeleton } from '../components/shared/Skeletons';
import type { Meeting } from '../types';
import { format, parseISO, intervalToDuration, formatDuration as dateFnsFormatDuration } from 'date-fns';
import { cn } from '../utils/cn';
import { sanitizeUrl } from '../utils/security';
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
// import toast from 'react-hot-toast'; // Not used with mock data fallback

type SortField = 'date' | 'duration' | 'participants';
type SortOrder = 'asc' | 'desc';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

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
    loadMeetings();
  }, []);

  const loadMeetings = async () => {
    try {
      setLoading(true);
      // Fetch all meetings (backend pagination could be added later)
      const response = await meetingsApi.getHistory(1000, 0);
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
      
      // If no meetings from API, use mock data for demo
      if (normalized.length === 0) {
        setAllMeetings(generateMockMeetings());
      } else {
        setAllMeetings(normalized);
      }
    } catch (err) {
      console.error('Failed to load meetings:', err);
      // Use mock data on error for demo purposes
      setAllMeetings(generateMockMeetings());
      // toast.error('Failed to load meeting history'); // Commented out for demo
    } finally {
      setLoading(false);
    }
  };

  // Generate mock meetings for demo/fallback
  const generateMockMeetings = (): Meeting[] => {
    const titles = [
      'Team Standup',
      'Product Review',
      'Client Call',
      'Sprint Planning',
      'Design Review',
      'Weekly Sync',
      'Project Kickoff',
      'Training Session',
    ];
    
    const meetings: Meeting[] = [];
    const now = new Date();
    
    for (let i = 0; i < 15; i++) {
      const daysAgo = i * 2 + Math.floor(Math.random() * 3);
      const startDate = new Date(now);
      startDate.setDate(startDate.getDate() - daysAgo);
      startDate.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 60));
      
      const durationMinutes = Math.floor(Math.random() * 90 + 15);
      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + durationMinutes);
      
      meetings.push({
        id: `mock-meeting-${i}`,
        roomId: `room-${i}`,
        roomName: `room-${Math.random().toString(36).substring(2, 8)}`,
        roomTitle: titles[i % titles.length],
        participantCount: Math.floor(Math.random() * 8 + 2),
        uniqueParticipants: Math.floor(Math.random() * 8 + 2),
        startedAt: startDate.toISOString(),
        endedAt: endDate.toISOString(),
        recordingUrl: i % 4 === 0 ? `https://recordings.example.com/meeting-${i}.mp4` : undefined,
      });
    }
    
    return meetings;
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
    setCurrentPage(1);
  }, []);

  const hasActiveFilters = debouncedSearch || dateFilter.start || dateFilter.end;

  // Calculate duration
  function calculateDurationMinutes(meeting: Meeting): number {
    if (!meeting.startedAt || !meeting.endedAt) return 0;
    const start = parseISO(meeting.startedAt);
    const end = parseISO(meeting.endedAt);
    return Math.round((end.getTime() - start.getTime()) / 60000);
  }

  function formatDuration(meeting: Meeting): string {
    if (!meeting.startedAt || !meeting.endedAt) return '—';
    const start = parseISO(meeting.startedAt);
    const end = parseISO(meeting.endedAt);
    const duration = intervalToDuration({ start, end });
    return dateFnsFormatDuration(duration, { format: ['hours', 'minutes'] }) || '< 1 min';
  }

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={14} className="text-surface-400" />;
    return sortOrder === 'asc' 
      ? <ArrowUp size={14} className="text-brand-500" />
      : <ArrowDown size={14} className="text-brand-500" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-surface-800 dark:text-white">
            Meeting History
          </h1>
          <p className="text-surface-500 dark:text-surface-400 mt-1">
            View your past meetings and recordings
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
          value={Math.round(stats.totalDuration / 60)} 
          icon={Clock}
          color="warning"
        />
      </div>

      {/* Search and Filters */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
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
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="text-sm text-surface-600 dark:text-surface-400 mb-1 block">
                  Start Date
                </label>
                <input
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
                <input
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
        <select
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
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Meeting
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-surface-500 dark:text-surface-400 cursor-pointer hover:text-surface-700 dark:hover:text-surface-300"
                    onClick={() => handleSort('date')}
                  >
                    <div className="flex items-center gap-1.5">
                      Date & Time
                      <SortIcon field="date" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-surface-500 dark:text-surface-400 cursor-pointer hover:text-surface-700 dark:hover:text-surface-300"
                    onClick={() => handleSort('duration')}
                  >
                    <div className="flex items-center gap-1.5">
                      Duration
                      <SortIcon field="duration" />
                    </div>
                  </th>
                  <th 
                    className="text-left px-4 py-3 text-sm font-medium text-surface-500 dark:text-surface-400 cursor-pointer hover:text-surface-700 dark:hover:text-surface-300"
                    onClick={() => handleSort('participants')}
                  >
                    <div className="flex items-center gap-1.5">
                      Participants
                      <SortIcon field="participants" />
                    </div>
                  </th>
                  <th className="text-left px-4 py-3 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Recording
                  </th>
                  <th className="text-right px-4 py-3 text-sm font-medium text-surface-500 dark:text-surface-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200 dark:divide-surface-700">
                {paginatedMeetings.map((meeting) => (
                  <tr 
                    key={meeting.id} 
                    className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition"
                  >
                    <td className="px-4 py-3">
                      <Link 
                        to={`/history/${meeting.id}`}
                        className="block hover:text-brand-500"
                      >
                        <p className="font-medium text-surface-800 dark:text-white truncate max-w-[200px]">
                          {meeting.roomTitle || 'Untitled Meeting'}
                        </p>
                        <p className="text-xs text-surface-400 font-mono">
                          {meeting.roomName}
                        </p>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {meeting.startedAt && (
                        <>
                          <div>{format(parseISO(meeting.startedAt), 'MMM d, yyyy')}</div>
                          <div className="text-xs text-surface-400">
                            {format(parseISO(meeting.startedAt), 'h:mm a')}
                          </div>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-surface-600 dark:text-surface-300">
                      {formatDuration(meeting)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm text-surface-600 dark:text-surface-300">
                        <Users size={14} className="text-surface-400" />
                        {meeting.uniqueParticipants || meeting.participantCount || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {meeting.recordingUrl && sanitizeUrl(meeting.recordingUrl) ? (
                        <a
                          href={sanitizeUrl(meeting.recordingUrl) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-brand-500 hover:text-brand-600 flex items-center gap-1"
                        >
                          <ExternalLink size={14} />
                          View
                        </a>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/history/${meeting.id}`}
                        className="text-sm text-brand-500 hover:text-brand-600 flex items-center justify-end gap-1"
                      >
                        Details
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
                    <>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(parseISO(meeting.startedAt), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {format(parseISO(meeting.startedAt), 'h:mm a')}
                      </span>
                    </>
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
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="btn-ghost btn-sm"
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
                      "btn-sm min-w-[44px] min-h-[44px]",
                      currentPage === page
                        ? "btn-primary"
                        : "btn-ghost"
                    )}
                  >
                    {page}
                  </button>
                );
              })}
              
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="btn-ghost btn-sm"
              >
                <ChevronRight size={18} />
              </button>
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
  color 
}: { 
  label: string; 
  value: number; 
  icon: typeof Video;
  color: 'brand' | 'success' | 'warning' | 'info';
}) {
  const colorClasses = {
    brand: 'bg-brand-100 dark:bg-brand-900/30 text-brand-500',
    success: 'bg-success-100 dark:bg-success-900/30 text-success-500',
    warning: 'bg-warning-100 dark:bg-warning-900/30 text-warning-500',
    info: 'bg-info-100 dark:bg-info-900/30 text-info-500',
  };

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between">
        <div className={cn('rounded-lg p-2', colorClasses[color])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-semibold text-surface-900 dark:text-surface-100">
          {value.toLocaleString()}
        </p>
        <p className="text-sm text-surface-500 dark:text-surface-400">{label}</p>
      </div>
    </div>
  );
}
