import type { AxiosResponse } from 'axios';
import api from './api';

// ============================================
// Admin API Types
// ============================================

export interface AdminStats {
  users: {
    total: number;
    active: number;
    banned: number;
    guests: number;
    byRole: {
      admin: number;
      moderator: number;
      participant: number;
    };
  };
  meetings: {
    total: number;
    ongoing: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  rooms: {
    total: number;
    active: number;
  };
  peakConcurrentUsers: number;
  bandwidth: {
    totalBytes: number;
    todayBytes: number;
  };
  alerts: {
    unread: number;
    critical: number;
  };
}

export interface BandwidthStats {
  data: Array<{
    date: string;
    bytes: number;
    meetings: number;
  }>;
  total: number;
}

export interface PeakUsersStats {
  data: Array<{
    date: string;
    peak: number;
    average: number;
  }>;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'moderator' | 'participant';
  isBanned: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface AdminUsersListResponse {
  users: AdminUser[];
  total: number;
  hasMore: boolean;
}

export interface AdminUserResponse {
  user: AdminUser;
}

export interface AdminUserActivity {
  id: string;
  type: 'login' | 'logout' | 'meeting_joined' | 'meeting_left' | 'meeting_created' | 'password_change' | 'profile_update' | 'ban' | 'unban';
  description: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUserActivityResponse {
  activities: AdminUserActivity[];
  total: number;
  hasMore: boolean;
}

export interface AdminUserDetail extends AdminUser {
  emailVerified: boolean;
  lastLoginIp: string | null;
  meetingsAttended: number;
  meetingsHosted: number;
  totalDurationMinutes: number;
}

export interface AdminUserDetailResponse {
  user: AdminUserDetail;
}

export interface AdminRoom {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  hostId: string;
  hostName: string | null;
  status: 'scheduled' | 'waiting' | 'active' | 'ended';
  maxParticipants: number | null;
  waitingRoomEnabled: boolean;
  createdAt: string;
  startedAt: string | null;
  endedAt: string | null;
  participantCount: number;
}

export interface AdminRoomsListResponse {
  rooms: AdminRoom[];
  total: number;
  hasMore: boolean;
}

export interface AdminRoomResponse {
  room: AdminRoom;
}

export interface AdminMeeting {
  id: string;
  roomId: string;
  roomName: string;
  roomTitle: string | null;
  hostId?: string;
  hostName?: string | null;
  participantCount: number;
  maxParticipants: number | null;
  recordingUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  status: 'ongoing' | 'ended';
}

export interface AdminMeetingsListResponse {
  meetings: AdminMeeting[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminMeetingResponse {
  meeting: AdminMeeting;
  participants: AdminMeetingParticipant[];
}

export interface AdminMeetingParticipant {
  userId: string | null;
  name: string | null;
  email: string | null;
  joinedAt: string;
  leftAt: string | null;
}

export interface AdminChatMessage {
  id: string;
  content: string;
  createdAt: string;
  messageType: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
}

export interface AdminChatMessagesResponse {
  messages: AdminChatMessage[];
  hasMore: boolean;
}

export interface AdminSystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  database: 'connected' | 'disconnected';
  redis: 'connected' | 'disconnected' | 'not_configured';
  livekit: 'connected' | 'disconnected';
  activeRooms: number;
  activeParticipants: number;
  memoryUsage: {
    used: number;
    total: number;
    percentage: number;
  };
  cpuUsage: number;
}

export interface AdminConfig {
  maxRoomsPerUser: number;
  maxParticipantsPerRoom: number;
  recordingEnabled: boolean;
  guestAccessEnabled: boolean;
  waitingRoomDefault: boolean;
  sessionTimeoutMinutes: number;
}

export interface AdminConfigResponse {
  config: AdminConfig;
}

export interface AdminAuditLog {
  id: string;
  action: string;
  targetType: 'user' | 'room' | 'meeting' | 'system';
  targetId: string | null;
  actorId: string;
  actorEmail: string;
  details: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminAuditLogsResponse {
  logs: AdminAuditLog[];
  total: number;
  hasMore: boolean;
}

export interface AdminAlert {
  id: string;
  type: 'server_load' | 'failed_recording' | 'user_report' | 'system' | 'security' | 'meeting';
  severity: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string | null;
  data: Record<string, unknown> | null;
  readAt: string | null;
  readBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

export interface AdminAlertsResponse {
  alerts: AdminAlert[];
  total: number;
  hasMore: boolean;
}

// ============================================
// System Settings Types
// ============================================

export interface RoomDefaultsSettings {
  maxParticipants: number;
  emptyTimeout: number;
  waitingRoomEnabled: boolean;
}

export interface RecordingSettings {
  storageType: 'local' | 's3';
  retentionDays: number;
}

export interface EmailSettings {
  fromAddress: string;
  fromName: string;
}

export interface AlertsSettings {
  serverLoadThreshold: number;
  failedRecordingAlert: boolean;
  userReportAlert: boolean;
  unusualActivityAlert: boolean;
}

export interface SystemSettings {
  room_defaults: RoomDefaultsSettings;
  recording: RecordingSettings;
  email: EmailSettings;
  alerts: AlertsSettings;
}

export interface SettingsResponse {
  settings: SystemSettings;
}

export interface SettingsUpdateResponse {
  message: string;
  updatedKeys: string[];
}

// ============================================
// Admin API Keys Types
// ============================================

export interface AdminApiKey {
  id: string;
  name: string;
  prefix: string;
  permissions: Record<string, unknown>;
  lastUsedAt: string | null;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: string;
  };
}

export interface AdminApiKeysResponse {
  keys: AdminApiKey[];
  total: number;
}

export interface AdminApiKeyActionResponse {
  success: boolean;
  message: string;
  key: {
    id: string;
    isActive: boolean;
  };
}

// ============================================
// Admin API Service
// ============================================

export const prashasakahApi = {
  // Dashboard
  getStats: (): Promise<AxiosResponse<AdminStats>> =>
    api.get('/prashasakah/stats'),

  // Stats with date range
  getStatsDetailed: (params?: { from?: string; to?: string }): Promise<AxiosResponse<AdminStats>> =>
    api.get('/prashasakah/stats', { params }),

  // Bandwidth chart data
  getBandwidthStats: (days?: number): Promise<AxiosResponse<BandwidthStats>> =>
    api.get('/prashasakah/stats/bandwidth', { params: { days } }),

  // Peak users chart data
  getPeakUsersStats: (days?: number): Promise<AxiosResponse<PeakUsersStats>> =>
    api.get('/prashasakah/stats/peak-users', { params: { days } }),

  getSystemHealth: (): Promise<AxiosResponse<{ health: AdminSystemHealth }>> =>
    api.get('/prashasakah/health'),

  // Users
  getUsers: (params?: {
    limit?: number;
    offset?: number;
    search?: string;
    role?: string;
    status?: 'active' | 'banned';
  }): Promise<AxiosResponse<AdminUsersListResponse>> =>
    api.get('/prashasakah/users', { params }),

  getUser: (id: string): Promise<AxiosResponse<AdminUserResponse>> =>
    api.get(`/prashasakah/users/${id}`),

  updateUser: (id: string, data: {
    name?: string;
    role?: 'admin' | 'moderator' | 'participant';
  }): Promise<AxiosResponse<AdminUserResponse>> =>
    api.patch(`/prashasakah/users/${id}`, data),

  banUser: (id: string, reason?: string): Promise<AxiosResponse<{ message: string; user: AdminUser }>> =>
    api.post(`/prashasakah/users/${id}/ban`, { reason }),

  unbanUser: (id: string): Promise<AxiosResponse<{ message: string; user: AdminUser }>> =>
    api.post(`/prashasakah/users/${id}/unban`),

  deleteUser: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/prashasakah/users/${id}`),

  resetPassword: (id: string): Promise<AxiosResponse<{ message: string; resetToken?: string; resetUrl?: string }>> =>
    api.post(`/prashasakah/users/${id}/reset-password`),

  changePassword: (id: string, password: string): Promise<AxiosResponse<{ message: string }>> =>
    api.put(`/prashasakah/users/${id}/change-password`, { password }),

  getUserActivity: (id: string, params?: {
    limit?: number;
    offset?: number;
  }): Promise<AxiosResponse<AdminUserActivityResponse>> =>
    api.get(`/prashasakah/users/${id}/activity`, { params }),

  resetUserPassword: (id: string): Promise<AxiosResponse<{ message: string; tempPassword?: string }>> =>
    api.post(`/prashasakah/users/${id}/reset-password`),

  // Rooms
  getRooms: (params?: {
    limit?: number;
    offset?: number;
    status?: string;
    search?: string;
  }): Promise<AxiosResponse<AdminRoomsListResponse>> =>
    api.get('/prashasakah/rooms', { params }),

  getRoom: (id: string): Promise<AxiosResponse<AdminRoomResponse>> =>
    api.get(`/prashasakah/rooms/${id}`),

  endRoom: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/prashasakah/rooms/${id}/end`),

  deleteRoom: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete(`/prashasakah/rooms/${id}`),

  // Meetings
  getMeetings: (params?: {
    limit?: number;
    offset?: number;
    roomId?: string;
    roomName?: string;
    hostId?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<AxiosResponse<AdminMeetingsListResponse>> =>
    api.get('/prashasakah/meetings', { params }),

  getMeeting: (id: string): Promise<AxiosResponse<AdminMeetingResponse>> =>
    api.get(`/prashasakah/meetings/${id}`),

  getMeetingChat: (id: string, params?: {
    limit?: number;
    before?: string;
  }): Promise<AxiosResponse<AdminChatMessagesResponse>> =>
    api.get(`/prashasakah/meetings/${id}/chat`, { params }),

  // Configuration
  getConfig: (): Promise<AxiosResponse<AdminConfigResponse>> =>
    api.get('/prashasakah/config'),

  updateConfig: (config: Partial<AdminConfig>): Promise<AxiosResponse<AdminConfigResponse>> =>
    api.patch('/prashasakah/config', config),

  // Audit Logs
  getAuditLogs: (params?: {
    limit?: number;
    offset?: number;
    action?: string;
    targetType?: string;
    actorId?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<AxiosResponse<AdminAuditLogsResponse>> =>
    api.get('/prashasakah/audit-logs', { params }),

  // Alerts
  getAlerts: (params?: {
    limit?: number;
    offset?: number;
    severity?: string;
    unreadOnly?: boolean;
  }): Promise<AxiosResponse<AdminAlertsResponse>> =>
    api.get('/prashasakah/alerts', { params }),

  markAlertAsRead: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/prashasakah/alerts/${id}/read`),

  resolveAlert: (id: string): Promise<AxiosResponse<{ message: string }>> =>
    api.post(`/prashasakah/alerts/${id}/resolve`),

  markAllAlertsAsRead: (): Promise<AxiosResponse<{ message: string; updated: number }>> =>
    api.post('/prashasakah/alerts/read-all'),

  // Bulk Operations
  bulkBanUsers: (userIds: string[], reason?: string): Promise<AxiosResponse<{ message: string; banned: number }>> =>
    api.post('/prashasakah/users/bulk-ban', { userIds, reason }),

  bulkEndRooms: (roomIds: string[]): Promise<AxiosResponse<{ message: string; ended: number }>> =>
    api.post('/prashasakah/rooms/bulk-end', { roomIds }),

  // Settings
  getSettings: (): Promise<AxiosResponse<SettingsResponse>> =>
    api.get('/prashasakah/settings'),

  updateSettings: (settings: Partial<SystemSettings>): Promise<AxiosResponse<SettingsUpdateResponse>> =>
    api.patch('/prashasakah/settings', settings),

  // Admin API Keys Management (Admin only)
  getAllApiKeys: (params?: {
    search?: string;
    is_active?: string;
    role?: string;
  }): Promise<AxiosResponse<AdminApiKeysResponse>> =>
    api.get('/prashasakah/api-keys/admin', { params }),

  revokeApiKey: (id: string, reason?: string): Promise<AxiosResponse<AdminApiKeyActionResponse>> =>
    api.patch(`/prashasakah/api-keys/admin/${id}`, { is_active: false, reason }),

  enableApiKey: (id: string, reason?: string): Promise<AxiosResponse<AdminApiKeyActionResponse>> =>
    api.patch(`/prashasakah/api-keys/admin/${id}`, { is_active: true, reason }),

  deleteApiKey: (id: string, reason?: string): Promise<AxiosResponse<{ success: boolean; message: string }>> =>
    api.delete(`/prashasakah/api-keys/admin/${id}`, { params: { reason } }),
};

export default prashasakahApi;
