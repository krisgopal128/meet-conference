/**
 * AuditLogs Page - Admin Audit Log Viewer
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminAuditLog } from '../../services/prashasakahApi';
import logger from '../../utils/logger';

export default function AuditLogs() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const cancelledRef = useRef(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const response = await prashasakahApi.getAuditLogs({
        limit: 20,
        offset: (page - 1) * 20,
        action: actionFilter || undefined,
      });
      if (!cancelledRef.current) {
        setLogs(response?.data?.logs || []);
        setTotalPages(Math.ceil((response?.data?.total || 0) / 20));
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
  }, [page, actionFilter]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchLogs();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchLogs]);

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      user_ban: '🚫',
      user_unban: '✅',
      user_delete: '🗑️',
      user_update: '✏️',
      meeting_end: '⏹️',
      room_delete: '🗑️',
      settings_update: '⚙️',
      login: '🔑',
    };
    return icons[action] || '📋';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">Audit Logs</h1>
          <p className="text-sm text-surface-500 mt-1">View all admin actions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">All Actions</option>
            <option value="user_ban">User Ban</option>
            <option value="user_unban">User Unban</option>
            <option value="user_delete">User Delete</option>
            <option value="user_update">User Update</option>
            <option value="meeting_end">Meeting End</option>
            <option value="room_delete">Room Delete</option>
            <option value="settings_update">Settings Update</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-surface-500">Loading...</div>
        ) : !logs || logs.length === 0 ? (
          <div className="p-8 text-center text-surface-500">No audit logs found</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-surface-200">
            <thead className="bg-surface-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Action
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Actor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Target
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  IP Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-surface-500 uppercase tracking-wider">
                  Timestamp
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-surface-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="flex items-center gap-2">
                      <span>{getActionIcon(log.action)}</span>
                      <span className="text-sm font-medium text-surface-800">{log.action}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {log.actorEmail}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {log.targetType}: {log.targetId || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {log.ipAddress || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-surface-500">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-surface-200">
            <div className="text-sm text-surface-600">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 text-sm font-medium text-surface-600 bg-white border border-surface-300 rounded-lg hover:bg-surface-50 disabled:opacity-50 transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium text-surface-600 bg-white border border-surface-300 rounded-lg hover:bg-surface-50 disabled:opacity-50 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
