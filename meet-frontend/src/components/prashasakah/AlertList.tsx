import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { AdminAlert } from '../../services/prashasakahApi';

/**
 * AlertList - List of alerts with severity badges and actions
 * 
 * Displays alert cards with severity colors, action buttons for
 * marking as read or resolving, and timestamp display.
 */

interface AlertListProps {
  alerts: AdminAlert[];
  loading?: boolean;
  onMarkAsRead: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
  processingId?: string | null;
}

// Severity configuration
const severityConfig: Record<string, { 
  color: string; 
  bgColor: string; 
  borderColor: string;
  icon: React.ReactNode;
}> = {
  critical: {
    color: 'text-red-700',
    bgColor: 'bg-danger-50',
    borderColor: 'border-danger-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  error: {
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  warning: {
    color: 'text-yellow-700',
    bgColor: 'bg-warning-50',
    borderColor: 'border-yellow-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  info: {
    color: 'text-brand-700',
    bgColor: 'bg-brand-50',
    borderColor: 'border-brand-200',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

// Alert type icons
const typeIcons: Record<string, React.ReactNode> = {
  server_load: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
    </svg>
  ),
  failed_recording: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  user_report: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  security: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  meeting: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  system: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

function getSeverityConfig(severity: string) {
  return severityConfig[severity] || severityConfig.info;
}

function getTypeIcon(type: string) {
  return typeIcons[type] || typeIcons.system;
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
  });
}

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AlertList({ 
  alerts, 
  loading, 
  onMarkAsRead, 
  onResolve,
  processingId 
}: AlertListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: alerts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-surface-200 p-4 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-surface-200 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-200 rounded w-1/3" />
                <div className="h-3 bg-surface-100 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-surface-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        <p className="text-surface-500">No alerts found</p>
        <p className="text-sm text-surface-400 mt-1">System alerts will appear here</p>
      </div>
    );
  }

  return (
    <div ref={parentRef} className="max-h-[600px] overflow-y-auto">
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const alert = alerts[virtualItem.index];
          const severity = getSeverityConfig(alert.severity);
          const typeIcon = getTypeIcon(alert.type);
          const isExpanded = expandedId === alert.id;
          const isRead = !!alert.readAt;
          const isResolved = !!alert.resolvedAt;
          const isProcessing = processingId === alert.id;

          return (
            <div
              key={alert.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div
                className={`bg-white rounded-lg shadow border-l-4 ${severity.borderColor} ${
                  isRead ? 'opacity-75' : ''
                } transition-opacity mb-3`}
              >
                {/* Main Content */}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Severity Icon */}
                    <div className={`p-2 rounded-full ${severity.bgColor} ${severity.color}`}>
                      {severity.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Type Badge */}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${severity.bgColor} ${severity.color}`}>
                          {typeIcon}
                          <span className="capitalize">{alert.type.replace('_', ' ')}</span>
                        </span>

                        {/* Status Badges */}
                        {isResolved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-success-100 text-green-700">
                            Resolved
                          </span>
                        )}
                        {!isRead && !isResolved && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-100 text-brand-700">
                            New
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h4 className={`mt-1 font-medium ${isRead ? 'text-surface-500' : 'text-surface-800'}`}>
                        {alert.title}
                      </h4>

                      {/* Message */}
                      {alert.message && (
                        <p className={`mt-1 text-sm ${isRead ? 'text-surface-500' : 'text-surface-500'}`}>
                          {alert.message}
                        </p>
                      )}

                      {/* Timestamp */}
                      <p className="mt-2 text-xs text-surface-400" title={formatFullDate(alert.createdAt)}>
                        {formatTimestamp(alert.createdAt)}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      {/* Expand Button */}
                      {alert.data && Object.keys(alert.data).length > 0 && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                          className="p-1.5 text-surface-400 hover:text-surface-500 transition-colors"
                          title="View details"
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
                      )}

                      {/* Mark as Read Button */}
                      {!isRead && (
                        <button
                          onClick={() => onMarkAsRead(alert.id)}
                          disabled={isProcessing}
                          className="p-1.5 text-surface-400 hover:text-brand-600 transition-colors disabled:opacity-50"
                          title="Mark as read"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
                          </svg>
                        </button>
                      )}

                      {/* Resolve Button */}
                      {!isResolved && (
                        <button
                          onClick={() => onResolve(alert.id)}
                          disabled={isProcessing}
                          className="p-1.5 text-surface-400 hover:text-success-600 transition-colors disabled:opacity-50"
                          title="Resolve"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && alert.data && Object.keys(alert.data).length > 0 && (
                  <div className="px-4 pb-4 pt-0">
                    <div className="bg-surface-50 rounded-lg p-3">
                      <p className="text-xs font-medium text-surface-500 mb-2">Alert Details</p>
                      <pre className="text-sm text-surface-800 overflow-x-auto">
                        {JSON.stringify(alert.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
