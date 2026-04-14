/**
 * Alerts Page - System Alerts Management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminAlert } from '../../services/prashasakahApi';
import logger from '../../utils/logger';

export default function Alerts() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const cancelledRef = useRef(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await prashasakahApi.getAlerts({
        severity: severityFilter || undefined,
      });
      if (!cancelledRef.current) {
        setAlerts(response?.data?.alerts || []);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        logger.error('Failed to load alerts:', err);
        toast.error('Failed to load alerts');
      }
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [severityFilter]);

  useEffect(() => {
    cancelledRef.current = false;
    fetchAlerts();
    return () => {
      cancelledRef.current = true;
    };
  }, [fetchAlerts]);

  const handleResolve = async (id: string) => {
    try {
      await prashasakahApi.resolveAlert(id);
      toast.success('Alert resolved');
      setAlerts(alerts.filter(a => a.id !== id));
    } catch {
      toast.error('Failed to resolve alert');
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await prashasakahApi.markAlertAsRead(id);
      setAlerts(alerts.map(a => 
        a.id === id ? { ...a, readAt: new Date().toISOString() } : a
      ));
      toast.success('Alert marked as read');
    } catch {
      toast.error('Failed to mark alert as read');
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'bg-brand-100 text-brand-800 border-brand-200',
      warning: 'bg-warning-100 text-yellow-800 border-yellow-200',
      error: 'bg-danger-100 text-danger-800 border-danger-200',
      critical: 'bg-red-200 text-red-900 border-red-300',
    };
    return colors[severity] || 'bg-surface-100 text-surface-700';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-800">Alert Center</h1>
          <p className="text-sm text-surface-500 mt-1">View and manage system alerts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-surface-200 p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border border-surface-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">All Severities</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>

      {/* Alerts List */}
      <div className="space-y-4">
        {loading ? (
          <div className="bg-white rounded-xl border border-surface-200 p-8 text-center text-surface-500">
            Loading...
          </div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="bg-white rounded-xl border border-surface-200 p-8 text-center text-surface-500">
            No alerts found
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-xl border border-surface-200 p-4 border-l-4 ${
                alert.resolvedAt ? 'opacity-60' : ''
              } ${
                alert.severity === 'critical' ? 'border-l-red-500' :
                alert.severity === 'error' ? 'border-l-red-400' :
                alert.severity === 'warning' ? 'border-l-yellow-400' :
                'border-l-brand-400'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-surface-500">{alert.type}</span>
                    {alert.resolvedAt && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-success-100 text-green-800">
                        Resolved
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-surface-800">{alert.title}</h3>
                  {alert.message && (
                    <p className="text-sm text-surface-500 mt-1">{alert.message}</p>
                  )}
                  <p className="text-xs text-surface-400 mt-2">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {!alert.readAt && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="px-3 py-1 text-sm text-brand-600 hover:text-brand-800 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
                    >
                      Mark Read
                    </button>
                  )}
                  {!alert.resolvedAt && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="px-3 py-1 text-sm text-success-600 hover:text-green-800 border border-green-200 rounded-lg hover:bg-success-50 transition-colors"
                    >
                      Resolve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
