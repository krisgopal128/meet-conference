/**
 * API Response Types
 * 
 * These types define the structure of API responses for type-safe API calls.
 * Import core types (User, Room, Meeting) from the main index file.
 */

import type { User, Room, Meeting, ScheduledMeeting } from './index';

// Re-export TokenResponse for convenience
export type { TokenResponse } from './index';

// ============================================
// Auth Responses
// ============================================

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterResponse {
  user: User;
  token: string;
}

export interface MeResponse {
  user: User;
}

export interface ProfileUpdateResponse {
  user: User;
  message?: string;
}

export interface LogoutResponse {
  message: string;
}

// ============================================
// Room Responses
// ============================================

export interface CreateRoomResponse {
  room: Room;
  message?: string;
}

export interface RoomsListResponse {
  rooms: Room[];
  total?: number;
}

export interface RoomResponse {
  room: Room;
}

export interface RoomParticipantsResponse {
  participants: RoomParticipant[];
}

export interface RoomParticipant {
  identity: string;
  name: string;
  state: 'connected' | 'disconnected';
  joinedAt: string;
  tracks: ParticipantTrack[];
}

export interface ParticipantTrack {
  sid: string;
  type: 'audio' | 'video';
  muted: boolean;
}

export interface LobbyResponse {
  lobby: LobbyParticipant[];
  participants?: LobbyParticipant[]; // alias for compatibility
}

export interface LobbyParticipant {
  identity: string;
  name: string;
  joinedAt: string;
  metadata?: string;
}

export interface LobbyActionResponse {
  message: string;
  admitted?: string;
  denied?: string;
}

export interface KickParticipantResponse {
  message: string;
}

export interface MuteParticipantResponse {
  message: string;
}

export interface ChatHistoryResponse {
  messages: ChatMessageResponse[];
  hasMore?: boolean;
  message?: ChatMessageResponse; // single message response (e.g., after sending)
}

export interface ChatMessageResponse {
  id: string;
  senderIdentity: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'system' | 'reaction' | 'private_chat';
  sentAt: string;
  recipientIdentity?: string;
  // Legacy snake_case fields for API compatibility
  sender_identity?: string;
  sender_name?: string;
  created_at?: string;
  createdAt?: string;
}

// ============================================
// Meeting Responses
// ============================================

export interface MeetingsHistoryResponse {
  meetings: Meeting[];
  total?: number;
  hasMore?: boolean;
}

export interface ScheduledMeetingsResponse {
  meetings: ScheduledMeeting[];
}

export interface ScheduleMeetingResponse {
  meeting: ScheduledMeeting;
  message?: string;
}

export interface MeetingResponse {
  meeting: Meeting;
}

export interface CancelMeetingResponse {
  message: string;
}

// ============================================
// Token Responses (Guest)
// ============================================

export interface GuestTokenResponse {
  token: string;
  identity: string;
  name: string;
  roomName: string;
  role: string;
  hostId?: string | null;
  expiresIn: number;
  inLobby?: boolean; // whether guest is placed in waiting room
  wasPreviouslyAdmitted?: boolean; // whether guest was auto-admitted (rejoining after disconnect)
}

// ============================================
// Health Responses
// ============================================

export interface HealthResponse {
  status: 'ok' | 'error';
  version?: string;
  uptime?: number;
}

export interface PingResponse {
  pong: boolean;
  timestamp?: string;
}

// ============================================
// Recording Responses
// ============================================

export interface RecordingResponse {
  message: string;
  isRecording: boolean;
  egressId?: string | null;
}

// ============================================
// Error Response
// ============================================

export interface ApiErrorResponse {
  error: string;
  message?: string;
  statusCode?: number;
}
