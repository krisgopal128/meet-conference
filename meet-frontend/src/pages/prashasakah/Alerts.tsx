/**
 * Alerts Page - System Alerts Management
 */

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminAlert } from '../../services/prashasakahApi';

export default function Alerts() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');

  useEffect(() => {
    fetchAlerts();
  }, [severityFilter]);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const response = await prashasakahApi.getAlerts({
        severity: severityFilter || undefined,
      });
      setAlerts(response?.data?.alerts || []);
    } catch (err) {
      console.error('Failed to load alerts:', err);
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await prashasakahApi.resolveAlert(id);
      toast.success('Alert resolved');
      setAlerts(alerts.filter(a => a.id !== id));
    } catch (err) {
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
    } catch (err) {
      toast.error('Failed to mark alert as read');
    }
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      info: 'bg-brand-100 text-brand-800 border-brand-200',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      error: 'bg-red-100 text-red-800 border-red-200',
      critical: 'bg-red-200 text-red-900 border-red-300',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alert Center</h1>
          <p className="text-sm text-gray-500 mt-1">View and manage system alerts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            Loading...
          </div>
        ) : !alerts || alerts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
            No alerts found
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-lg shadow p-4 border-l-4 ${
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
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs text-gray-500">{alert.type}</span>
                    {alert.resolvedAt && (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-800">
                        Resolved
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-gray-900">{alert.title}</h3>
                  {alert.message && (
                    <p className="text-sm text-gray-500 mt-1">{alert.message}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {!alert.readAt && (
                    <button
                      onClick={() => handleMarkRead(alert.id)}
                      className="px-3 py-1 text-sm text-brand-600 hover:text-brand-800 border border-brand-200 rounded hover:bg-brand-50"
                    >
                      Mark Read
                    </button>
                  )}
                  {!alert.resolvedAt && (
                    <button
                      onClick={() => handleResolve(alert.id)}
                      className="px-3 py-1 text-sm text-green-600 hover:text-green-800 border border-green-200 rounded hover:bg-green-50"
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
