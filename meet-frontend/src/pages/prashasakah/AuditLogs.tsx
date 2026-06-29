/**
 * AuditLogs Page - Admin Audit Log Viewer
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminAuditLog } from '../../services/prashasakahApi';
import AuditLogTable from '../../components/prashasakah/AuditLogTable';
import DateRangeFilter from '../../components/prashasakah/DateRangeFilter';
import logger from '../../utils/logger';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'user_ban', label: 'User Ban' },
  { value: 'user_unban', label: 'User Unban' },
  { value: 'user_delete', label: 'User Delete' },
  { value: 'user_update', label: 'User Update' },
  { value: 'role_change', label: 'Role Change' },
  { value: 'password_reset', label: 'Password Reset' },
  { value: 'password_change', label: 'Password Change' },
  { value: 'meeting_end', label: 'Meeting End' },
  { value: 'room_delete', label: 'Room Delete' },
  { value: 'room_end', label: 'Room End' },
  { value: 'settings_update', label: 'Settings Update' },
  { value: 'config_update', label: 'Config Update' },
  { value: 'api_key_create', label: 'API Key Create' },
  { value: 'api_key_delete', label: 'API Key Delete' },
  { value: 'api_key_update', label: 'API Key Update' },
  { value: 'api_key_regenerate', label: 'API Key Regenerate' },
  { value: 'auth_failed', label: 'Auth Failed' },
];

export default function AuditLogs() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const cancelledRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await prashasakahApi.getAuditLogs({
        limit: 50,
        offset: (page - 1) * 50,
        action: actionFilter || undefined,
        targetType: targetTypeFilter || undefined,
        fromDate: dateFrom || undefined,
        toDate: dateTo || undefined,
      });
      if (!cancelledRef.current) {
        setLogs(response?.data?.logs || []);
        setTotal(response?.data?.total || 0);
        setTotalPages(Math.ceil((response?.data?.total || 0) / 50));
      }
    } catch (err) {
      if (!cancelledRef.current) {
        logger.error('Failed to load audit logs:', err);
        toast.error('Failed to load audit logs');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [page, actionFilter, targetTypeFilter, dateFrom, dateTo]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchLogs();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchLogs]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-surface-800 dark:text-white">Audit Logs</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            {total > 0 ? `${total.toLocaleString()} total entries` : 'View all admin actions'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Action Type</label>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
              aria-label="Filter by action type"
              className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
            >
              {ACTION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="min-w-[140px]">
            <label className="block text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Target Type</label>
            <select
              value={targetTypeFilter}
              onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
              aria-label="Filter by target type"
              className="w-full px-3 py-2 border border-surface-300 dark:border-surface-600 dark:bg-surface-800 dark:text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition-all"
            >
              <option value="">All Targets</option>
              <option value="user">User</option>
              <option value="room">Room</option>
              <option value="meeting">Meeting</option>
              <option value="system">System</option>
              <option value="api_key">API Key</option>
            </select>
          </div>

          <DateRangeFilter onChange={(from, to) => { setDateFrom(from); setDateTo(to); setPage(1); }} />

          {(actionFilter || targetTypeFilter || dateFrom || dateTo) && (
            <button
              onClick={() => { setActionFilter(''); setTargetTypeFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}
              className="px-3 py-2 text-sm text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors shrink-0"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <AuditLogTable logs={logs} loading={loading} />

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-surface-900 px-4 py-3 flex items-center justify-between border-t border-surface-200 dark:border-surface-700 rounded-xl">
          <div className="text-sm text-surface-600 dark:text-surface-300">
            Page <span className="font-medium">{page}</span> of {totalPages}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium text-surface-600 dark:text-surface-300 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 disabled:opacity-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
