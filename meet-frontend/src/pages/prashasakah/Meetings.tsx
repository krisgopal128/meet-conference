/**
 * Meetings Page - Admin Meeting Management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminMeeting } from '../../services/prashasakahApi';
import DateRangeFilter from '../../components/prashasakah/DateRangeFilter';
import logger from '../../utils/logger';

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
    if (!minutes) return '-';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      ongoing: 'bg-green-100 text-green-800',
      ended: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-800',
      active: 'bg-green-100 text-green-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      ongoing: 'Active',
      ended: 'Ended',
      scheduled: 'Scheduled',
      active: 'Active',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800 dark:text-white">Meeting History</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">View and manage all meetings</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          <div className="flex-1 min-w-64 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by room name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">All Status</option>
            <option value="ongoing">Active</option>
            <option value="ended">Ended</option>
          </select>
          <DateRangeFilter onChange={handleDateChange} />
          <button
            onClick={handleSearch}
            className="px-4 py-2 text-sm font-medium text-white bg-brand-600 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            Search
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500 dark:text-surface-400">Loading...</div>
        ) : !meetings || meetings.length === 0 ? (
          <div className="p-8 text-center text-surface-500 dark:text-surface-400">No meetings found</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Room
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Participants
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-surface-200">
              {meetings.map((meeting) => (
                <tr key={meeting.id} className="hover:bg-surface-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-surface-800">{meeting.roomName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {meeting.startedAt ? new Date(meeting.startedAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {formatDuration(meeting.duration || 0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {meeting.participantCount || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(meeting.status)}`}>
                      {getStatusLabel(meeting.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link
                      to={`/prashasakah/meetings/${meeting.id}`}
                      className="text-brand-600 hover:text-brand-900"
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
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-surface-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="relative inline-flex items-center px-4 py-2 border border-surface-300 text-sm font-medium rounded-lg text-surface-600 bg-white hover:bg-surface-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-surface-300 text-sm font-medium rounded-lg text-surface-600 bg-white hover:bg-surface-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-surface-600">
                  Page <span className="font-medium">{page}</span> of{' '}
                  <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-lg -space-x-px">
                  <button
                    onClick={() => setPage(page - 1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-lg border border-surface-300 bg-white text-sm font-medium text-surface-500 hover:bg-surface-50 disabled:opacity-50 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(page + 1)}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-lg border border-surface-300 bg-white text-sm font-medium text-surface-500 hover:bg-surface-50 disabled:opacity-50 transition-colors"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
