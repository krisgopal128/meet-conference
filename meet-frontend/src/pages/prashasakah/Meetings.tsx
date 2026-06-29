/**
 * Meetings Page - Admin Meeting Management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminMeeting } from '../../services/prashasakahApi';
import DateRangeFilter from '../../components/prashasakah/DateRangeFilter';
import logger from '../../utils/logger';

const STATUS_BADGE_STYLES: Record<string, string> = {
  ongoing: 'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 ring-1 ring-green-200',
  ended: 'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-surface-50 text-surface-600 ring-1 ring-surface-200',
  scheduled: 'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  active: 'inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-green-50 text-green-700 ring-1 ring-green-200',
};
const STATUS_DOT_STYLES: Record<string, string> = {
  ongoing: 'bg-green-500',
  ended: 'bg-surface-400',
  scheduled: 'bg-blue-500',
  active: 'bg-green-500',
};
const STATUS_LABELS: Record<string, string> = {
  ongoing: 'Active',
  ended: 'Ended',
  scheduled: 'Scheduled',
  active: 'Active',
};

export default function Meetings() {
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const cancelledRef = useRef(false);

  const fetchMeetings = useCallback(async () => {
    setLoading(true);
    try {
      const response = await prashasakahApi.getMeetings({
        limit: 20,
        offset: (page - 1) * 20,
        roomName: appliedSearch,
        status: status || undefined,
        fromDate: dateFrom,
        toDate: dateTo,
      });
      if (!cancelledRef.current) {
        setMeetings(response?.data?.meetings || []);
        setTotalPages(Math.ceil((response?.data?.total || 0) / 20));
      }
    } catch (err) {
      if (!cancelledRef.current) {
        logger.error('Failed to load meetings:', err);
        toast.error('Failed to load meetings');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [page, appliedSearch, status, dateFrom, dateTo]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchMeetings();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchMeetings]);

  const handleSearch = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
    setPage(1);
  };

  const formatDuration = (minutes: number) => {
    if (!minutes) return '—';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-surface-800 dark:text-white">Meeting History</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">View and manage all meetings</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Search</label>
            <input aria-label="Search by room name"
              type="text"
              placeholder="Search by room name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
            />
          </div>
          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Status</label>
            <select aria-label="Filter by status"
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
            >
              <option value="">All Status</option>
              <option value="ongoing">Active</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <DateRangeFilter onChange={handleDateChange} />
          <button
            onClick={handleSearch}
            className="px-5 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 transition-all shrink-0"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-flex items-center gap-2 text-surface-400">
              <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-surface-500 dark:text-surface-400">Loading meetings...</span>
            </div>
          </div>
        ) : !meetings || meetings.length === 0 ? (
          <div className="p-12 text-center">
            <svg className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-surface-500 dark:text-surface-400 text-sm">No meetings found</p>
            <p className="text-surface-400 dark:text-surface-500 text-xs mt-1">Try adjusting your filters</p>
          </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200 dark:divide-surface-700">
            <thead className="bg-surface-50 dark:bg-surface-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Room
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Participants
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-surface-900 divide-y divide-surface-200 dark:divide-surface-700">
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-surface-800 dark:text-white">{meeting.roomName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500 dark:text-surface-400">
                    {meeting.startedAt ? new Date(meeting.startedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500 dark:text-surface-400">
                    {formatDuration(meeting.duration || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500 dark:text-surface-400">
                    <span className="inline-flex items-center gap-1">
                      <svg className="w-4 h-4 text-surface-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      {meeting.participantCount || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={STATUS_BADGE_STYLES[meeting.status] || STATUS_BADGE_STYLES['ended']}>
                      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_STYLES[meeting.status] || 'bg-surface-400'}`}></span>
                      {STATUS_LABELS[meeting.status] || meeting.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/prashasakah/meetings/${meeting.id}`}
                      className="text-brand-600 hover:text-brand-700 dark:text-brand-400 transition-colors"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center justify-between border-t border-surface-200 dark:border-surface-700 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-surface-300 dark:border-surface-600 text-sm font-medium rounded-lg text-surface-600 dark:text-surface-300 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
              >Previous</button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-surface-300 dark:border-surface-600 text-sm font-medium rounded-lg text-surface-600 dark:text-surface-300 bg-white dark:bg-surface-800 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
              >Next</button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Page <span className="font-medium text-surface-700 dark:text-surface-200">{page}</span> of{' '}
                  <span className="font-medium text-surface-700 dark:text-surface-200">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-lg -space-x-px">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-3 py-2 rounded-l-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm font-medium text-surface-500 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
                  >Previous</button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-3 py-2 rounded-r-lg border border-surface-300 dark:border-surface-600 bg-white dark:bg-surface-800 text-sm font-medium text-surface-500 dark:text-surface-300 hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
                  >Next</button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
