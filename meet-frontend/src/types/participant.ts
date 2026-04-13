/**
 * Participant-related types for the meet application
 */

import type { Participant, RemoteParticipant, LocalParticipant } from 'livekit-client';

// Re-export for convenience
export type { Participant, RemoteParticipant, LocalParticipant };

// Union type for any participant
export type AnyParticipant = RemoteParticipant | LocalParticipant;

// Type guard to check if participant is remote
export function isRemoteParticipant(participant: AnyParticipant): participant is RemoteParticipant {
  return 'identity' in participant && !('local' in participant && participant.local);
}

// Type guard to check if participant is local
export function isLocalParticipant(participant: AnyParticipant): participant is LocalParticipant {
  return 'identity' in participant && 'local' in participant && participant.local === true;
}

// Participant role in meeting
export type ParticipantRole = 'host' | 'cohost' | 'presenter' | 'attendee' | 'viewer';

// Participant permissions
export interface ParticipantPermissions {
  canPublish: boolean;
  canSubscribe: boolean;
  canPublishData: boolean;
  canUpdateMetadata: boolean;
  hidden: boolean;
  recorder: boolean;
}

// Participant state for UI
export interface ParticipantUIState {
  identity: string;
  name: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  isSpeaking: boolean;
  audioLevel: number;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'unknown';
  role: ParticipantRole;
  joinedAt: Date;
}

// Participant action types
export type ParticipantAction = 
  | 'mute' 
  | 'unmute' 
  | 'disableCamera' 
  | 'enableCamera' 
  | 'disableScreenShare'
  | 'kick';

// Bulk participant action
export interface BulkParticipantAction {
  action: ParticipantAction;
  participantIdentities: string[];
  timestamp: Date;
}
