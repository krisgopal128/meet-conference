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

// Module-level reference to auth store getState — set by authStore after creation
// This avoids circular dependency while allowing the interceptor to read the store
let _authStoreGetState: (() => { token: string | null; user: unknown; isAuthenticated: boolean }) | null = null;
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

/**
 * Generate a per-session CSRF token and store it.
 * Sent via custom header for double-submit cookie pattern.
 */
let csrfToken: string | null = null;
function getCsrfToken(): string {
  if (!csrfToken) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    csrfToken = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return csrfToken;
}

// Add auth token and CSRF token to requests
api.interceptors.request.use((config) => {
  // Add CSRF token for state-changing requests
  const method = config.method?.toUpperCase();
  if (method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    config.headers['X-CSRF-Token'] = getCsrfToken();
  }

  // Try to get token from multiple sources (defensive)
  let token: string | null = null;

  // Source 1: Zustand persisted storage (primary)
  const authStorage = localStorage.getItem('auth-storage');
  if (authStorage) {
    try {
      const parsed = JSON.parse(authStorage);
      token = parsed?.state?.token || null;
    } catch {
      // Ignore parse errors
    }
  }

  // Source 2: Direct localStorage keys (fallback)
  if (!token) {
    token = localStorage.getItem('auth_token') || localStorage.getItem('token');
  }

  // Source 3: Zustand store directly (handles rehydration timing)
  if (!token) {
    try {
      const storeState = _authStoreGetState?.();
      if (storeState?.token) {
        token = storeState.token;
      }
    } catch {
      // Store not available yet
    }
  }

  if (token) {
    const expired = isTokenExpired(token);
    if (expired === true) {
      // Token is expired - clear auth and reject
      localStorage.removeItem('auth-storage');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?reason=expired';
      return Promise.reject(new Error('Token expired'));
    }
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this is a password-required error for guest access (not an auth failure)
      const errorMsg = error.response?.data?.error || '';
      const isPasswordError = errorMsg.includes('password');
      
      // Only clear auth and redirect if user was trying to access protected resource
      // Don't redirect guests on public pages (join, room, login, register, thank-you)
      const isPublicPage = window.location.pathname.match(/^\/(join|room|login|register|thank-you)/);
      
      if (!isPasswordError && !isPublicPage) {
        // Clear zustand auth storage
        localStorage.removeItem('auth-storage');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
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

  getGuestToken: (roomName: string, name: string, role: 'attendee' | 'viewer' = 'attendee'): Promise<AxiosResponse<GuestTokenResponse>> =>
    api.post<GuestTokenResponse>('/token/guest', { roomName, name, role }),
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
    scheduledAt?: string;
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
  getSettings: (roomName: string): Promise<AxiosResponse<{ settings: { gridAspectRatio?: string; videoFitMode?: string } }>> =>
    api.get(`/rooms/${roomName}/settings`),

  updateSettings: (roomName: string, settings: { gridAspectRatio?: string; videoFitMode?: string }): Promise<AxiosResponse<{ settings: object }>> =>
    api.put(`/rooms/${roomName}/settings`, settings),

  // Recording - uses /egress endpoints
  startRecording: (roomName: string): Promise<AxiosResponse<RecordingResponse>> =>
    api.post<RecordingResponse>('/egress/start', { roomName }),

  stopRecording: (egressId: string): Promise<AxiosResponse<RecordingResponse>> =>
    api.post<RecordingResponse>('/egress/stop', { egressId }),
};

// Simple export for direct use
export const createRoom = (data: {
  name: string;
  title?: string;
  description?: string;
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

export const getRoomSettings = (roomName: string): Promise<AxiosResponse<{ settings: { gridAspectRatio?: string; videoFitMode?: string } }>> =>
  api.get(`/rooms/${roomName}/settings`);

export const updateRoomSettings = (roomName: string, settings: { gridAspectRatio?: string; videoFitMode?: string }): Promise<AxiosResponse<{ settings: object }>> =>
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
    qualityOverrideReason: 'network' | 'cpu' | 'battery' | null;
    connectionQualityLabel: string;
    packetLossPercent: number | null;
    rttMs: number | null;
    jitterMs: number | null;
    availableBitrateKbps: number | null;
    batteryLevelPercent?: number | null;
    batteryCharging?: boolean | null;
    diagnosticsLog: Array<{
      at: string;
      type: 'network' | 'cpu' | 'battery' | 'recovery' | 'manual';
      message: string;
    }>;
    userAgent?: string;
    capturedAt: string;
  }): Promise<AxiosResponse<{ message: string; file: string }>> =>
    api.post<{ message: string; file: string }>('/meetings/diagnostics', data),

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
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      const hasAuth = !!parsed?.state?.isAuthenticated && !!parsed?.state?.token;
      if (hasAuth && parsed.state.token) {
        // Also check token expiry
        const expired = isTokenExpired(parsed.state.token);
        if (expired === true) return false;
      }
      return hasAuth;
    }
  } catch {
    // Ignore parse errors
  }
  return false;
}

export default api;
