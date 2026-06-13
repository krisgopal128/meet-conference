/**
 * Alerts Page - System Alerts Management
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { prashasakahApi, AdminAlert } from '../../services/prashasakahApi';
import AlertList from '../../components/prashasakah/AlertList';
import logger from '../../utils/logger';

export default function Alerts() {
  const [alerts, setAlerts] = useState<AdminAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
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
      setProcessingId(id);
      await prashasakahApi.resolveAlert(id);
      toast.success('Alert resolved');
      setAlerts((prev) => prev.filter((alert) => alert.id !== id));
    } catch {
      toast.error('Failed to resolve alert');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      setProcessingId(id);
      await prashasakahApi.markAlertAsRead(id);
      setAlerts((prev) => prev.map((alert) =>
        alert.id === id ? { ...alert, readAt: new Date().toISOString() } : alert
      ));
      toast.success('Alert marked as read');
    } catch {
      toast.error('Failed to mark alert as read');
    } finally {
      setProcessingId(null);
    }
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
            aria-label="Filter by severity"
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
      <AlertList
        alerts={alerts}
        loading={loading}
        onMarkAsRead={handleMarkRead}
        onResolve={handleResolve}
        processingId={processingId}
      />
    </div>
  );
}
