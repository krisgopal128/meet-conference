import { useState } from 'react';
import { AdminAuditLog } from '../../services/prashasakahApi';

/**
 * AuditLogTable - Data table for audit log entries
 * 
 * Displays admin actions with action type icons, expandable details,
 * and timestamp information.
 */

interface AuditLogTableProps {
  logs: AdminAuditLog[];
  loading?: boolean;
}

// Action type icons and colors
const actionConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  user_create: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
    color: 'bg-success-100 text-success-600',
    label: 'User Created',
  },
  user_update: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    color: 'bg-brand-100 text-brand-600',
    label: 'User Updated',
  },
  user_ban: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      </svg>
    ),
    color: 'bg-danger-100 text-danger-600',
    label: 'User Banned',
  },
  user_unban: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'bg-success-100 text-success-600',
    label: 'User Unbanned',
  },
  user_delete: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    color: 'bg-danger-100 text-danger-600',
    label: 'User Deleted',
  },
  password_reset: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    color: 'bg-warning-100 text-warning-600',
    label: 'Password Reset',
  },
  settings_update: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: 'bg-brand-100 text-brand-600',
    label: 'Settings Updated',
  },
  meeting_end: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
      </svg>
    ),
    color: 'bg-surface-100 text-surface-500',
    label: 'Meeting Ended',
  },
  room_delete: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    ),
    color: 'bg-danger-100 text-danger-600',
    label: 'Room Deleted',
  },
  default: {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    color: 'bg-surface-100 text-surface-500',
    label: 'Action',
  },
};

function getActionConfig(action: string) {
  return actionConfig[action] || actionConfig.default;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AuditLogTable({ logs, loading }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-surface-100 p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-surface-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-200 rounded w-1/3" />
                <div className="h-3 bg-surface-100 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-surface-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-surface-500">No audit logs found</p>
        <p className="text-sm text-surface-400 mt-1">Admin actions will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {/* Table Header */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-surface-50 border-b border-surface-200 text-xs font-medium text-surface-500 uppercase tracking-wider">
        <div className="col-span-1">Type</div>
        <div className="col-span-3">Action</div>
        <div className="col-span-2">Admin</div>
        <div className="col-span-2">Target</div>
        <div className="col-span-2">Time</div>
        <div className="col-span-2">Details</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-surface-100">
        {logs.map((log) => {
          const config = getActionConfig(log.action);
          const isExpanded = expandedId === log.id;

          return (
            <div key={log.id}>
              {/* Main Row */}
              <div 
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 hover:bg-surface-50 cursor-pointer items-center"
                onClick={() => toggleExpand(log.id)}
              >
                {/* Action Type Icon */}
                <div className="col-span-1 flex items-center">
                  <div className={`p-2 rounded-full ${config.color}`}>
                    {config.icon}
                  </div>
                </div>

                {/* Action */}
                <div className="col-span-3">
                  <p className="font-medium text-surface-800">{config.label}</p>
                  <p className="text-sm text-surface-500 md:hidden">{log.actorEmail}</p>
                </div>

                {/* Admin */}
                <div className="col-span-2 hidden md:block">
                  <p className="text-sm text-surface-800 truncate">{log.actorEmail}</p>
                </div>

                {/* Target */}
                <div className="col-span-2 hidden md:block">
                  {log.targetId ? (
                    <div>
                      <p className="text-sm text-surface-800 capitalize">{log.targetType}</p>
                      <p className="text-xs text-surface-500 font-mono truncate">{log.targetId.slice(0, 8)}...</p>
                    </div>
                  ) : (
                    <span className="text-sm text-surface-400">—</span>
                  )}
                </div>

                {/* Time */}
                <div className="col-span-2">
                  <p className="text-sm text-surface-500" title={formatFullDate(log.createdAt)}>
                    {formatTimestamp(log.createdAt)}
                  </p>
                </div>

                {/* Expand Button */}
                <div className="col-span-2 flex justify-end">
                  <button
                    className="p-1 text-surface-400 hover:text-surface-500 transition-colors"
                    aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 py-3 bg-surface-50 border-t border-surface-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Full Timestamp */}
                    <div>
                      <p className="text-xs font-medium text-surface-500 mb-1">Full Timestamp</p>
                      <p className="text-sm text-surface-800">{formatFullDate(log.createdAt)}</p>
                    </div>

                    {/* IP Address */}
                    <div>
                      <p className="text-xs font-medium text-surface-500 mb-1">IP Address</p>
                      <p className="text-sm text-surface-800 font-mono">{log.ipAddress || 'Not recorded'}</p>
                    </div>

                    {/* Target ID */}
                    {log.targetId && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 mb-1">Target ID</p>
                        <p className="text-sm text-surface-800 font-mono break-all">{log.targetId}</p>
                      </div>
                    )}

                    {/* Action Details */}
                    {log.details && Object.keys(log.details).length > 0 && (
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-surface-500 mb-1">Details</p>
                        <pre className="text-sm text-surface-800 bg-white p-3 rounded border border-surface-200 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
