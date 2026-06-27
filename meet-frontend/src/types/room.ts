/**
 * Room-specific types for the meet application
 */

import type { Participant, RemoteParticipant, LocalParticipant } from 'livekit-client';

// Re-export Participant types from livekit-client for convenience
export type { Participant, RemoteParticipant, LocalParticipant };

// Union type for any participant (local or remote)
export type AnyParticipant = RemoteParticipant | LocalParticipant;

// Room status types
export type RoomStatus = 'scheduled' | 'waiting' | 'active' | 'ended';

// Room creation payload
export interface CreateRoomPayload {
  name: string;
  title?: string;
  description?: string;
  password?: string;
  maxParticipants?: number;
  waitingRoomEnabled?: boolean;
  startsAt?: string;
  endsAt?: string;
}

// Room state for Redis caching
export interface RoomState {
  roomName: string;
  status: RoomStatus;
  participantCount: number;
  hostIdentity: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

// Room with participant details
export interface RoomWithParticipants {
  id: string;
  name: string;
  host_id: string;
  status: RoomStatus;
  created_at: Date;
  updated_at: Date;
  participants: ParticipantInfo[];
}

// Participant info for API responses
export interface ParticipantInfo {
  id: string;
  user_id: string | null;
  identity: string;
  role: string;
  joined_at: Date;
  left_at: Date | null;
}

// Lobby participant (waiting to be admitted)
export interface LobbyParticipantInfo {
  identity: string;
  name: string;
  joinedAt: number;
  metadata?: string;
}

// Room configuration
export interface RoomConfig {
  maxParticipants: number;
  waitingRoomEnabled: boolean;
  recordingEnabled: boolean;
  chatEnabled: boolean;
}
