import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AdminAuditLog } from '../../services/prashasakahApi';

/**
 * AuditLogTable - Data table for audit log entries
 *
 * Displays admin actions with action type icons, expandable details,
 * IP address, user-agent, and formatted detail fields.
 */

interface AuditLogTableProps {
  logs: AdminAuditLog[];
  loading?: boolean;
}

type ActionCategory = 'create' | 'update' | 'delete' | 'security' | 'ban' | 'config' | 'info';

interface ActionMeta {
  icon: React.ReactNode;
  color: string;
  label: string;
  category: ActionCategory;
}

const ICON_BASE = 'w-5 h-5';

const actionConfig: Record<string, ActionMeta> = {
  user_ban: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>),
    color: 'bg-red-100 text-red-600',
    label: 'User Banned',
    category: 'ban',
  },
  user_unban: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
    color: 'bg-green-100 text-green-600',
    label: 'User Unbanned',
    category: 'create',
  },
  user_delete: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>),
    color: 'bg-red-100 text-red-600',
    label: 'User Deleted',
    category: 'delete',
  },
  user_update: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>),
    color: 'bg-blue-100 text-blue-600',
    label: 'User Updated',
    category: 'update',
  },
  role_change: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>),
    color: 'bg-purple-100 text-purple-600',
    label: 'Role Changed',
    category: 'config',
  },
  password_reset: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>),
    color: 'bg-amber-100 text-amber-600',
    label: 'Password Reset',
    category: 'security',
  },
  password_change: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>),
    color: 'bg-amber-100 text-amber-600',
    label: 'Password Changed',
    category: 'security',
  },
  meeting_end: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>),
    color: 'bg-surface-100 text-surface-500',
    label: 'Meeting Ended',
    category: 'info',
  },
  room_delete: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>),
    color: 'bg-red-100 text-red-600',
    label: 'Room Deleted',
    category: 'delete',
  },
  room_end: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
    color: 'bg-surface-100 text-surface-500',
    label: 'Room Ended',
    category: 'info',
  },
  settings_update: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>),
    color: 'bg-blue-100 text-blue-600',
    label: 'Settings Updated',
    category: 'config',
  },
  config_update: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /></svg>),
    color: 'bg-blue-100 text-blue-600',
    label: 'Config Updated',
    category: 'config',
  },
  api_key_create: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>),
    color: 'bg-green-100 text-green-600',
    label: 'API Key Created',
    category: 'create',
  },
  api_key_delete: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" /></svg>),
    color: 'bg-red-100 text-red-600',
    label: 'API Key Deleted',
    category: 'delete',
  },
  api_key_update: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>),
    color: 'bg-blue-100 text-blue-600',
    label: 'API Key Updated',
    category: 'update',
  },
  api_key_regenerate: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>),
    color: 'bg-purple-100 text-purple-600',
    label: 'API Key Regenerated',
    category: 'security',
  },
  auth_failed: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>),
    color: 'bg-red-100 text-red-600',
    label: 'Auth Failed',
    category: 'security',
  },
  default: {
    icon: (<svg className={ICON_BASE} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>),
    color: 'bg-surface-100 text-surface-500',
    label: 'Action',
    category: 'info' as ActionCategory,
  },
};

function getActionConfig(action: string): ActionMeta {
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
    second: '2-digit',
  });
}

/** Human-readable label for common detail keys */
const DETAIL_LABELS: Record<string, string> = {
  reason: 'Reason',
  fromRole: 'Previous Role',
  toRole: 'New Role',
  name: 'Name',
  role: 'Role',
  feature_flags: 'Feature Flags',
  method: 'Method',
  isActive: 'Active',
  ownerId: 'Owner ID',
  updatedKeys: 'Updated Keys',
  email: 'Email',
  attempt: 'Attempt',
  tempPassword: 'Temporary Password',
};

function DetailRow({ label, value }: { label: string; value: unknown }) {
  const displayLabel = DETAIL_LABELS[label] || label.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const displayValue = typeof value === 'boolean' ? (value ? 'Yes' : 'No')
    : typeof value === 'object' ? JSON.stringify(value)
    : String(value);

  return (
    <div className="flex gap-2 py-0.5">
      <span className="text-xs font-medium text-surface-500 dark:text-surface-400 min-w-[120px] shrink-0">{displayLabel}:</span>
      <span className="text-xs text-surface-700 dark:text-surface-200 break-all">{displayValue}</span>
    </div>
  );
}

export default function AuditLogTable({ logs, loading }: AuditLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60,
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="border-b border-surface-100 dark:border-surface-800 p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-surface-200 dark:bg-surface-700 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-200 dark:bg-surface-700 rounded w-1/3" />
                <div className="h-3 bg-surface-100 dark:bg-surface-800 rounded w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-surface-500 dark:text-surface-400">No audit logs found</p>
        <p className="text-sm text-surface-400 dark:text-surface-500 mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden">
      {/* Table Header */}
      <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 text-xs font-medium text-surface-500 dark:text-surface-400 uppercase tracking-wider">
        <div className="col-span-1">Type</div>
        <div className="col-span-3">Action</div>
        <div className="col-span-2">Admin</div>
        <div className="col-span-2">Target</div>
        <div className="col-span-2">IP Address</div>
        <div className="col-span-1">Time</div>
        <div className="col-span-1"></div>
      </div>

      {/* Table Body - Virtualized */}
      <div ref={parentRef} className="max-h-[600px] overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const log = logs[virtualItem.index];
            const config = getActionConfig(log.action);
            const isExpanded = expandedId === log.id;

            return (
              <div
                key={log.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                className="border-b border-surface-100 dark:border-surface-800"
              >
                {/* Main Row */}
                <div
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-800/50 cursor-pointer items-center"
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
                    <p className="font-medium text-surface-800 dark:text-white text-sm">{config.label}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 md:hidden">
                      {log.actorName || log.actorEmail}
                    </p>
                  </div>

                  {/* Admin */}
                  <div className="col-span-2 hidden md:block">
                    <p className="text-sm text-surface-800 dark:text-surface-200 truncate">
                      {log.actorName || log.actorEmail}
                    </p>
                    {log.actorName && (
                      <p className="text-xs text-surface-400 dark:text-surface-500 truncate">{log.actorEmail}</p>
                    )}
                  </div>

                  {/* Target */}
                  <div className="col-span-2 hidden md:block">
                    {log.targetId ? (
                      <div>
                        <p className="text-sm text-surface-700 dark:text-surface-300 capitalize">{log.targetType}</p>
                        <p className="text-xs text-surface-400 dark:text-surface-500 font-mono truncate">{log.targetId.slice(0, 8)}…</p>
                      </div>
                    ) : (
                      <span className="text-sm text-surface-400 dark:text-surface-500 capitalize">{log.targetType || '—'}</span>
                    )}
                  </div>

                  {/* IP Address */}
                  <div className="col-span-2 hidden md:block">
                    <p className="text-sm text-surface-500 dark:text-surface-400 font-mono truncate">
                      {log.ipAddress || '—'}
                    </p>
                  </div>

                  {/* Time */}
                  <div className="col-span-1">
                    <p className="text-sm text-surface-500 dark:text-surface-400 whitespace-nowrap" title={formatFullDate(log.createdAt)}>
                      {formatTimestamp(log.createdAt)}
                    </p>
                  </div>

                  {/* Expand Button */}
                  <div className="col-span-1 flex justify-end">
                    <svg
                      className={`w-5 h-5 text-surface-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-surface-50 dark:bg-surface-800/50 border-t border-surface-100 dark:border-surface-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Full Timestamp */}
                      <div>
                        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Full Timestamp</p>
                        <p className="text-sm text-surface-800 dark:text-surface-200">{formatFullDate(log.createdAt)}</p>
                      </div>

                      {/* IP Address */}
                      <div>
                        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">IP Address</p>
                        <p className="text-sm text-surface-800 dark:text-surface-200 font-mono">{log.ipAddress || 'Not recorded'}</p>
                      </div>

                      {/* Target ID (full) */}
                      {log.targetId && (
                        <div>
                          <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Target ID</p>
                          <p className="text-sm text-surface-800 dark:text-surface-200 font-mono break-all">{log.targetId}</p>
                        </div>
                      )}

                      {/* User Agent */}
                      {log.userAgent && (
                        <div>
                          <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">User Agent</p>
                          <p className="text-sm text-surface-700 dark:text-surface-300 break-all">{log.userAgent}</p>
                        </div>
                      )}

                      {/* Actor ID */}
                      {log.actorId && (
                        <div>
                          <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">Actor ID</p>
                          <p className="text-sm text-surface-800 dark:text-surface-200 font-mono">{log.actorId}</p>
                        </div>
                      )}

                      {/* Action Details - formatted */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">Details</p>
                          <div className="bg-white dark:bg-surface-900 p-3 rounded-lg border border-surface-200 dark:border-surface-700">
                            {Object.entries(log.details).map(([key, value]) => (
                              <DetailRow key={key} label={key} value={value} />
                            ))}
                          </div>
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
    </div>
  );
}
