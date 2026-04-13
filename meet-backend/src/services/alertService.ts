/**
 * Alert Service
 * 
 * Helper functions for creating admin alerts.
 * Used to notify admins of important system events.
 */

import { query } from './database.js';

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertType = 'server_load' | 'failed_recording' | 'user_report' | 'system' | 'security' | 'meeting';

export interface CreateAlertParams {
  type: AlertType;
  severity?: AlertSeverity;
  title: string;
  message?: string;
  data?: Record<string, unknown>;
}

/**
 * Create a new admin alert
 */
export async function createAlert(params: CreateAlertParams): Promise<string> {
  const { type, severity = 'info', title, message, data } = params;
  
  const result = await query<{ id: string }>(
    `INSERT INTO admin_alerts (type, severity, title, message, data)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [type, severity, title, message || null, data ? JSON.stringify(data) : null]
  );
  
  return result[0]?.id || '';
}

/**
 * Create a high server load alert
 */
export async function createHighServerLoadAlert(
  loadPercentage: number,
  details?: { cpuUsage?: number; memoryUsage?: number; activeRooms?: number; activeParticipants?: number }
): Promise<string> {
  const severity: AlertSeverity = loadPercentage >= 90 ? 'critical' : loadPercentage >= 80 ? 'warning' : 'info';
  
  return createAlert({
    type: 'server_load',
    severity,
    title: `High Server Load: ${loadPercentage}%`,
    message: `Server resource usage has reached ${loadPercentage}%. Consider scaling or investigating.`,
    data: {
      loadPercentage,
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Create a failed recording alert
 */
export async function createFailedRecordingAlert(
  meetingId: string,
  roomName: string,
  error?: string,
  details?: { duration?: number; participantCount?: number; startedAt?: string }
): Promise<string> {
  return createAlert({
    type: 'failed_recording',
    severity: 'error',
    title: `Recording Failed: ${roomName}`,
    message: error || 'Recording failed to complete for an active meeting.',
    data: {
      meetingId,
      roomName,
      error,
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Create a user report alert
 */
export async function createUserReportAlert(
  reportId: string,
  reporterId: string,
  reporterEmail: string,
  reportedUserId: string | undefined,
  reportedUserEmail: string | undefined,
  reason: string,
  details?: { meetingId?: string; roomName?: string; description?: string }
): Promise<string> {
  return createAlert({
    type: 'user_report',
    severity: 'warning',
    title: `User Report: ${reason}`,
    message: `User ${reporterEmail} reported ${reportedUserEmail || 'an anonymous user'} for: ${reason}`,
    data: {
      reportId,
      reporterId,
      reporterEmail,
      reportedUserId,
      reportedUserEmail,
      reason,
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Create a security alert
 */
export async function createSecurityAlert(
  title: string,
  message: string,
  details?: { ipAddress?: string; userId?: string; action?: string }
): Promise<string> {
  return createAlert({
    type: 'security',
    severity: 'critical',
    title,
    message,
    data: {
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Create a meeting-related alert
 */
export async function createMeetingAlert(
  meetingId: string,
  roomName: string,
  title: string,
  message: string,
  severity: AlertSeverity = 'info',
  details?: Record<string, unknown>
): Promise<string> {
  return createAlert({
    type: 'meeting',
    severity,
    title,
    message,
    data: {
      meetingId,
      roomName,
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Create a system alert
 */
export async function createSystemAlert(
  title: string,
  message: string,
  severity: AlertSeverity = 'info',
  details?: Record<string, unknown>
): Promise<string> {
  return createAlert({
    type: 'system',
    severity,
    title,
    message,
    data: {
      timestamp: new Date().toISOString(),
      ...details,
    },
  });
}

/**
 * Get unread alert count
 */
export async function getUnreadAlertCount(): Promise<number> {
  const result = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM admin_alerts WHERE read_at IS NULL'
  );
  return parseInt(result[0]?.count || '0');
}

/**
 * Get critical unread alert count
 */
export async function getCriticalAlertCount(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM admin_alerts WHERE read_at IS NULL AND severity = 'critical'"
  );
  return parseInt(result[0]?.count || '0');
}

export default {
  createAlert,
  createHighServerLoadAlert,
  createFailedRecordingAlert,
  createUserReportAlert,
  createSecurityAlert,
  createMeetingAlert,
  createSystemAlert,
  getUnreadAlertCount,
  getCriticalAlertCount,
};
