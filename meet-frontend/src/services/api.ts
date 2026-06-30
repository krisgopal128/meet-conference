import axios, { AxiosResponse } from 'axios';
import type {
  LoginResponse,
  RegisterResponse,
  MeResponse,
  ProfileUpdateResponse,
  LogoutResponse,
  CreateRoomResponse,
  RoomsListResponse,
  RoomResponse,
  RoomParticipantsResponse,
  LobbyResponse,
  LobbyActionResponse,
  KickParticipantResponse,
  MuteParticipantResponse,
  ChatHistoryResponse,
  MeetingsHistoryResponse,
  ScheduledMeetingsResponse,
  ScheduleMeetingResponse,
  MeetingResponse,
  CancelMeetingResponse,
  GuestTokenResponse,
  HealthResponse,
  PingResponse,
  RecordingResponse,
} from '../types/api';
import type { TokenResponse, Meeting, MeetingParticipant } from '../types';
import { isTokenExpired } from '../utils/security';
import { useAuthStore } from '../store/authStore';

// Module-level reference to auth store getState — set by authStore after creation
// This avoids circular dependency while allowing the interceptor to read the store
let _authStoreGetState: (() => { token: string | null; user: unknown; isAuthenticated: boolean; initialized: boolean }) | null = null;
export function registerAuthStore(getState: typeof _authStoreGetState) {
  _authStoreGetState = getState;
}

// Use the full API URL from environment
const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000, // 15 seconds
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Send cookies for CSRF protection
});

// Attach auth token + CSRF token to requests
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // CSRF double-submit: read csrf_token cookie, send as X-CSRF-Token header
  const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  if (csrfMatch) {
    config.headers['X-CSRF-Token'] = csrfMatch[1];
  }
  return config;
});

// Handle 401 responses — try token refresh before giving up
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) resolve(token);
    else reject(error);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Check if this is a password-required error for guest access
      const errorMsg = error.response?.data?.error || '';
      const isPasswordError = errorMsg.includes('password');
      if (isPasswordError) {
        return Promise.reject(error);
      }

      // Don't try to refresh on public pages
      const isPublicPage = window.location.pathname.match(/^\/(join|room|login|register|thank-you)/);
      if (isPublicPage) {
        return Promise.reject(error);
      }

      // Don't try to refresh if this IS the refresh request
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Refresh itself failed — clear auth and redirect
        useAuthStore.setState({ user: null, token: null, isAuthenticated: false, initialized: true });
        window.location.href = '/login';
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        const refreshRes = await api.post<LoginResponse>('/auth/refresh');
        const newToken = refreshRes.data?.token;

        if (newToken) {
          useAuthStore.setState({ token: newToken, user: refreshRes.data.user, isAuthenticated: true, initialized: true });

          // Process queued requests
          processQueue(null, newToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed — clear auth
        processQueue(refreshError, null);
        useAuthStore.setState({ user: null, token: null, isAuthenticated: false, initialized: true });
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// Retry interceptor for transient 5xx errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (!config) return Promise.reject(error);

    const retryCount = config.__retryCount || 0;
    const maxRetries = 2;

    // Only retry on 5xx errors (not 4xx) and not on auth/refresh routes
    const is5xx = error.response?.status >= 500;
    const isAuthRoute = config.url?.includes('/auth/');
    if (!is5xx || isAuthRoute || retryCount >= maxRetries) {
      return Promise.reject(error);
    }

    config.__retryCount = retryCount + 1;
    const delay = 1000 * Math.pow(2, retryCount); // 1s, 2s
    await new Promise((r) => setTimeout(r, delay));
    return api(config);
  }
);

// ============================================
// Auth API
// ============================================
export const authApi = {
  register: (email: string, password: string, name?: string, rememberMe?: boolean): Promise<AxiosResponse<RegisterResponse>> =>
    api.post<RegisterResponse>('/auth/register', { email, password, name, rememberMe }),

  login: (email: string, password: string, rememberMe?: boolean): Promise<AxiosResponse<LoginResponse>> =>
    api.post<LoginResponse>('/auth/login', { email, password, rememberMe }),

  getMe: (): Promise<AxiosResponse<MeResponse>> =>
    api.get<MeResponse>('/auth/me'),

  updateProfile: (data: { name?: string; avatarUrl?: string }): Promise<AxiosResponse<ProfileUpdateResponse>> =>
    api.patch<ProfileUpdateResponse>('/auth/profile', data),

  logout: (): Promise<AxiosResponse<LogoutResponse>> =>
    api.post<LogoutResponse>('/auth/logout'),

  forgotPassword: (email: string): Promise<AxiosResponse<{ message: string }>> =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string): Promise<AxiosResponse<{ message: string }>> =>
    api.post<{ message: string }>('/auth/reset-password', { token, password }),

  refresh: (): Promise<AxiosResponse<LoginResponse>> =>
    api.post<LoginResponse>('/auth/refresh'),
};

// ============================================
// Token API
// ============================================
export const tokenApi = {
  getToken: (roomName: string, role: string = 'attendee', identity?: string, name?: string): Promise<AxiosResponse<TokenResponse>> =>
    api.post<TokenResponse>('/token', { roomName, role, identity, name }),

  getGuestToken: (roomName: string, name: string, role: 'attendee' | 'viewer' = 'attendee', password?: string): Promise<AxiosResponse<GuestTokenResponse>> =>
    api.post<GuestTokenResponse>('/token/guest', { roomName, name, role, password }),
};

// Simple export for direct use
export const getToken = (roomName: string, role?: string): Promise<AxiosResponse<TokenResponse>> =>
  api.post<TokenResponse>('/token', { roomName, role });

export const getGuestToken = (roomName: string, guestName: string, password?: string): Promise<AxiosResponse<GuestTokenResponse>> =>
  api.post<GuestTokenResponse>('/token/guest', { roomName, name: guestName, password });

// ============================================
// Rooms API
// ============================================
export const roomsApi = {
  create: (data: {
    name: string;
    title?: string;
    description?: string;
    password?: string;
    waitingRoomEnabled?: boolean;
    maxParticipants?: number;
    startsAt?: string;
  }): Promise<AxiosResponse<CreateRoomResponse>> =>
    api.post<CreateRoomResponse>('/rooms', data),

  list: (all = false): Promise<AxiosResponse<RoomsListResponse>> =>
    api.get<RoomsListResponse>(`/rooms?all=${all}`),

  get: (name: string): Promise<AxiosResponse<RoomResponse>> =>
    api.get<RoomResponse>(`/rooms/${name}`),

  update: (name: string, data: Partial<{
    title: string;
    description: string;
    maxParticipants: number;
    status: string;
    waitingRoomEnabled: boolean;
  }>): Promise<AxiosResponse<RoomResponse>> =>
    api.patch<RoomResponse>(`/rooms/${name}`, data),

  delete: (name: string): Promise<AxiosResponse<{ message: string }>> =>
    api.delete<{ message: string }>(`/rooms/${name}`),

  getParticipants: (roomName: string): Promise<AxiosResponse<RoomParticipantsResponse>> =>
    api.get<RoomParticipantsResponse>(`/rooms/${roomName}/participants`),

  kickParticipant: (roomName: string, identity: string): Promise<AxiosResponse<KickParticipantResponse>> =>
    api.post<KickParticipantResponse>(`/rooms/${roomName}/kick/${identity}`),

  muteParticipant: (roomName: string, identity: string): Promise<AxiosResponse<MuteParticipantResponse>> =>
    api.post<MuteParticipantResponse>(`/rooms/${roomName}/mute/${identity}`),

  muteVideo: (roomName: string, identity: string): Promise<AxiosResponse<MuteParticipantResponse>> =>
    api.post<MuteParticipantResponse>(`/rooms/${roomName}/mute-video/${identity}`),

  disableScreenShare: (roomName: string, identity: string): Promise<AxiosResponse<MuteParticipantResponse>> =>
    api.post<MuteParticipantResponse>(`/rooms/${roomName}/disable-screen/${identity}`),

  muteAllParticipants: (roomName: string): Promise<AxiosResponse<MuteParticipantResponse>> =>
    api.post<MuteParticipantResponse>(`/rooms/${roomName}/mute-all`),

  disableAllCameras: (roomName: string): Promise<AxiosResponse<MuteParticipantResponse>> =>
    api.post<MuteParticipantResponse>(`/rooms/${roomName}/disable-all-cameras`),

  // Lobby management
  getLobby: (roomName: string): Promise<AxiosResponse<LobbyResponse>> =>
    api.get<LobbyResponse>(`/rooms/${roomName}/lobby`),

  admitParticipant: (roomName: string, identity: string): Promise<AxiosResponse<LobbyActionResponse>> =>
    api.post<LobbyActionResponse>(`/rooms/${roomName}/admit/${identity}`),

  admitAllParticipants: (roomName: string): Promise<AxiosResponse<LobbyActionResponse>> =>
    api.post<LobbyActionResponse>(`/rooms/${roomName}/admit-all`),

  denyAllParticipants: (roomName: string): Promise<AxiosResponse<LobbyActionResponse>> =>
    api.post<LobbyActionResponse>(`/rooms/${roomName}/deny-all`),

  // Whiteboard + lock — server-enforced (Stage 3)
  toggleWhiteboard: (roomName: string, active: boolean): Promise<AxiosResponse<{ message: string; active: boolean }>> =>
    api.post(`/rooms/${roomName}/whiteboard/toggle`, { active }),

  toggleMeetingLock: (roomName: string, meetingLocked: boolean): Promise<AxiosResponse<{ message: string; meetingLocked: boolean }>> =>
    api.post(`/rooms/${roomName}/lock/toggle`, { meetingLocked }),

  // Meeting control
  startMeeting: (roomName: string): Promise<AxiosResponse<{ message: string; status: string }>> =>
    api.post(`/rooms/${roomName}/start`),

  endMeeting: (roomName: string): Promise<AxiosResponse<{ message: string; status: string }>> =>
    api.post(`/rooms/${roomName}/end`),

  getChatHistory: (roomName: string, limit = 200): Promise<AxiosResponse<ChatHistoryResponse>> =>
    api.get<ChatHistoryResponse>(`/rooms/${roomName}/chat?limit=${limit}`),

  sendChatMessage: (roomName: string, content: string, messageType = 'text'): Promise<AxiosResponse<ChatHistoryResponse>> =>
    api.post<ChatHistoryResponse>(`/rooms/${roomName}/chat`, { content, messageType }),

  // Room settings (grid aspect ratio, etc.)
  getSettings: (roomName: string): Promise<AxiosResponse<{ settings: { gridAspectRatio?: string; videoFitMode?: string; meetingLocked?: boolean; participantsCanShareScreen?: boolean; participantsCanChat?: boolean; participantsCanUnmute?: boolean; participantsCanTurnOnCamera?: boolean } }>> =>
    api.get(`/rooms/${roomName}/settings`),

  updateSettings: (roomName: string, settings: { gridAspectRatio?: string; videoFitMode?: string; meetingLocked?: boolean; participantsCanShareScreen?: boolean; participantsCanChat?: boolean; participantsCanUnmute?: boolean; participantsCanTurnOnCamera?: boolean }): Promise<AxiosResponse<{ settings: object }>> =>
    api.put(`/rooms/${roomName}/settings`, settings),

  // Recording - uses /egress endpoints
  startRecording: (roomName: string): Promise<AxiosResponse<RecordingResponse>> =>
    api.post<RecordingResponse>('/egress/start', { roomName }),

  stopRecording: (egressId: string): Promise<AxiosResponse<RecordingResponse>> =>
    api.post<RecordingResponse>('/egress/stop', { egressId }),

  listRecordings: (limit = 20, offset = 0): Promise<AxiosResponse<{ recordings: any[]; total: number; hasMore: boolean }>> =>
    api.get('/egress/list', { params: { limit, offset } }),
};

// Simple export for direct use
export const createRoom = (data: {
  name: string;
  title?: string;
  description?: string;
  password?: string;
  maxParticipants?: number;
  emptyTimeout?: number;
  startsAt?: string;
  endsAt?: string;
  waitingRoomEnabled?: boolean;
}): Promise<AxiosResponse<CreateRoomResponse>> =>
  api.post<CreateRoomResponse>('/rooms', data);

export const getRoom = (name: string): Promise<AxiosResponse<RoomResponse>> =>
  api.get<RoomResponse>(`/rooms/${name}`);

export const getMyRooms = (): Promise<AxiosResponse<RoomsListResponse>> =>
  api.get<RoomsListResponse>('/rooms');

export const getRoomSettings = (roomName: string): Promise<AxiosResponse<{ settings: { gridAspectRatio?: string; videoFitMode?: string; meetingLocked?: boolean; participantsCanShareScreen?: boolean; participantsCanChat?: boolean; participantsCanUnmute?: boolean; participantsCanTurnOnCamera?: boolean } }>> =>
  api.get(`/rooms/${roomName}/settings`);

export const updateRoomSettings = (roomName: string, settings: { gridAspectRatio?: string; videoFitMode?: string; meetingLocked?: boolean; participantsCanShareScreen?: boolean; participantsCanChat?: boolean; participantsCanUnmute?: boolean; participantsCanTurnOnCamera?: boolean }): Promise<AxiosResponse<{ settings: object }>> =>
  api.put(`/rooms/${roomName}/settings`, settings);

// ============================================
// Meetings API
// ============================================
export const meetingsApi = {
  // Get meeting history list
  getHistory: (limit = 20, offset = 0): Promise<AxiosResponse<MeetingsHistoryResponse>> =>
    api.get<MeetingsHistoryResponse>(`/meetings/history?limit=${limit}&offset=${offset}`),

  // Get single meeting details from history
  getMeetingDetails: (id: string): Promise<AxiosResponse<{ meeting: Meeting; participants: MeetingParticipant[] }>> =>
    api.get(`/meetings/${id}`),

  getScheduled: (): Promise<AxiosResponse<ScheduledMeetingsResponse>> =>
    api.get<ScheduledMeetingsResponse>('/meetings/scheduled'),

  getStats: (): Promise<AxiosResponse<{
    stats: {
      totalMeetings: number;
      totalParticipants: number;
      totalMinutes: number;
      thisWeek: number;
    };
  }>> =>
    api.get('/meetings/stats'),

  schedule: (data: {
    title: string;
    description?: string;
    scheduledStart: string;
    scheduledEnd?: string;
    participantEmails?: string[];
    timezone?: string;
  }): Promise<AxiosResponse<ScheduleMeetingResponse>> =>
    api.post<ScheduleMeetingResponse>('/meetings/schedule', data),

  get: (id: string): Promise<AxiosResponse<MeetingResponse>> =>
    api.get<MeetingResponse>(`/meetings/${id}`),

  cancel: (id: string): Promise<AxiosResponse<CancelMeetingResponse>> =>
    api.delete<CancelMeetingResponse>(`/meetings/scheduled/${id}`),

  update: (id: string, data: {
    title?: string;
    description?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    timezone?: string;
  }): Promise<AxiosResponse<ScheduleMeetingResponse>> =>
    api.patch<ScheduleMeetingResponse>(`/meetings/scheduled/${id}`, data),

  uploadDiagnostics: (data: {
    roomName?: string;
    participantIdentity?: string;
    selectedQualityMode: string;
    effectiveQualityMode: string;
    screenShareMode: string;
    autoFallbackActive: boolean;
    qualityOverrideReason: 'network' | 'cpu' | 'battery' | 'decode' | null;
    connectionQualityLabel: string;
    packetLossPercent: number | null;
    rttMs: number | null;
    jitterMs: number | null;
    availableBitrateKbps: number | null;
    batteryLevelPercent?: number | null;
    batteryCharging?: boolean | null;
    diagnosticsLog: Array<{
      at: string;
      type: 'network' | 'cpu' | 'battery' | 'decode' | 'recovery' | 'manual';
      message: string;
    }>;
    userAgent?: string;
    capturedAt: string;
  }): Promise<AxiosResponse<{ message: string; file: string }>> =>
    api.post<{ message: string; file: string }>('/meetings/diagnostics', data),

  uploadDiagnosticsSnapshot: (data: {
    roomName: string;
    bytesSent: number | null;
    bytesReceived: number | null;
    packetsLost: number | null;
    rttMs: number | null;
    codec: string | null;
    packetLossPct: number | null;
    jitterMs: number | null;
    availableBitrateKbps: number | null;
    framesDropped: number | null;
  }): Promise<AxiosResponse<{ message: string }>> =>
    api.post<{ message: string }>('/meetings/diagnostics/snapshot', data),

  getChat: (id: string, limit = 100, before?: string): Promise<AxiosResponse<ChatHistoryResponse>> => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.append('before', before);
    return api.get<ChatHistoryResponse>(`/meetings/${id}/chat?${params}`);
  },

  sendChat: (id: string, content: string, messageType = 'text'): Promise<AxiosResponse<ChatHistoryResponse>> =>
    api.post<ChatHistoryResponse>(`/meetings/${id}/chat`, { content, messageType }),
};

// ============================================
// Health Check
// ============================================
export const healthApi = {
  check: (): Promise<AxiosResponse<HealthResponse>> =>
    api.get<HealthResponse>('/health'),
  ping: (): Promise<AxiosResponse<PingResponse>> =>
    api.get<PingResponse>('/ping'),
};

// ============================================
// Auth State Helper
// ============================================
/**
 * Check if user is authenticated (reads from localStorage)
 * Used by components that can't use hooks
 */
export function isAuthenticated(): boolean {
  const state = useAuthStore.getState();
  if (!state.isAuthenticated || !state.token) return false;
  const expired = isTokenExpired(state.token);
  return expired !== true;
}

export default api;
