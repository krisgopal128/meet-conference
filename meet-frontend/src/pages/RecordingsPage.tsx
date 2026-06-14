import { useState, useEffect, useRef, useCallback } from 'react';
import { roomsApi } from '../services/api';
import toast from 'react-hot-toast';
import { sanitizeUrl } from '../utils/security';

interface Recording {
  egressId: string;
  roomName: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  filename?: string;
  url?: string;
  duration?: number;
  size?: number;
}

// Module-scoped pure functions — no state dependency
function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString();
  } catch {
    return dateStr;
  }
}

function formatDuration(start: string, end?: string) {
  if (!end) return 'In progress';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function formatSize(bytes?: number) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusColor(status: string) {
  switch (status) {
    case 'EGRESS_ACTIVE': return 'text-green-500';
    case 'EGRESS_COMPLETE': return 'text-brand-500';
    case 'EGRESS_FAILED': case 'EGRESS_ABORTED': return 'text-red-500';
    default: return 'text-surface-400';
  }
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 20;
  const mountedRef = useRef(true);

  const fetchRecordings = useCallback(async (newOffset = 0) => {
    setLoading(true);
    try {
      const res = await roomsApi.listRecordings(limit, newOffset);
      if (!mountedRef.current) return;
      setRecordings(res.data.recordings || []);
      setTotal(res.data.total ?? 0);
      setOffset(newOffset);
    } catch {
      if (!mountedRef.current) return;
      toast.error('Failed to load recordings');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchRecordings();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchRecordings]);

  // Refresh data when user returns to the tab (re-fetch current page)
  useEffect(() => {
    const handleFocus = () => {
      if (mountedRef.current) fetchRecordings(offset);
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [offset, fetchRecordings]);

  if (loading && recordings.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6 text-surface-800 dark:text-white">
        Recordings
      </h1>

      {recordings.length === 0 ? (
        <div className="text-center py-16 text-surface-500 dark:text-surface-400">
          <svg className="mx-auto h-12 w-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">No recordings yet</p>
          <p className="text-sm mt-1">Start recording during a meeting to see recordings here.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
            {total} recording{total !== 1 ? 's' : ''} found
          </p>

          <div className="space-y-3">
            {recordings.map((rec) => (
              <div
                key={rec.egressId}
                className="border rounded-lg p-4 bg-white dark:bg-gray-800 dark:border-gray-700 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-surface-800 dark:text-white truncate">
                      {rec.roomName || 'Unknown Room'}
                    </h3>
                    <div className="mt-1 text-sm text-surface-500 dark:text-surface-400 space-y-0.5">
                      <p>📅 {formatDate(rec.startedAt)}</p>
                      <p>⏱️ {formatDuration(rec.startedAt, rec.endedAt)}</p>
                      <p>📁 {formatSize(rec.size)}</p>
                      <p className={statusColor(rec.status)}>
                        ● {rec.status?.replace('EGRESS_', '')}
                      </p>
                    </div>
                  </div>

                  {rec.url && sanitizeUrl(rec.url) && (
                    <a
                      href={sanitizeUrl(rec.url) ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md text-white bg-brand-600 hover:bg-brand-700 transition-colors"
                    >
                      ▶ Play
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => fetchRecordings(offset - limit)}
                disabled={offset === 0}
                className="px-4 py-2 text-sm rounded-md border border-surface-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                ← Previous
              </button>
              <span className="text-sm text-surface-500">
                {Math.floor(offset / limit) + 1} / {Math.ceil(total / limit)}
              </span>
              <button
                onClick={() => fetchRecordings(offset + limit)}
                disabled={offset + limit >= total}
                className="px-4 py-2 text-sm rounded-md border border-surface-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
