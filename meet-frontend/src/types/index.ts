export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string;
  role: 'admin' | 'moderator' | 'participant';
  isBanned?: boolean;
  is_banned?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  /** Per-moderator feature locks (allow-list). null/undefined = no lock. */
  featureFlags?: FeatureFlags | null;
}

/**
 * Per-moderator feature locks. An allow-list: a key present and true means the
 * moderator CAN use that feature; absent or false means blocked.
 * Only meaningful for role === 'moderator'. Room hosts always bypass.
 */
export type FeatureFlagKey =
  | 'whiteboard'
  | 'recording'
  | 'screen_share'
  | 'mute_all'
  | 'kick'
  | 'lock_meeting'
  | 'lobby_control';

export type FeatureFlags = Partial<Record<FeatureFlagKey, boolean>>;

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
}

export interface Room {
  id: string;
  name: string;
  title?: string | null;
  description?: string | null;
  hostId?: string;
  hostName?: string;
  maxParticipants?: number;
  waitingRoomEnabled?: boolean;
  status: 'scheduled' | 'waiting' | 'active' | 'ended';
  createdAt?: string;
  startsAt?: string;
  endsAt?: string;
  isActive?: boolean;
  // Legacy snake_case fields (for API compatibility)
  host_id?: string;
  host_name?: string;
  max_participants?: number;
  created_at?: string;
}

export interface Meeting {
  id: string;
  roomId: string;
  roomName: string;
  roomTitle: string | null;
  participantCount: number;
  uniqueParticipants?: number;  // Actual count from meeting_participants
  maxParticipants?: number;
  recordingUrl?: string;
  startedAt: string;
  endedAt?: string;
  chatMessageCount?: number;
  participants?: MeetingParticipant[];
  // Legacy snake_case fields
  room_id?: string;
  room_name?: string;
  room_title?: string | null;
  participant_count?: number;
  unique_participants?: number;
  max_participants?: number;
  recording_url?: string;
  started_at?: string;
  ended_at?: string;
}

export interface MeetingParticipant {
  id: string;
  identity: string;
  name?: string;
  joinedAt?: string;
  leftAt?: string;
  isModerator?: boolean;
  duration?: number; // Duration in minutes
}

export interface ScheduledMeeting {
  id: string;
  roomName: string;
  title: string;
  description?: string;
  hostId: string;
  hostName?: string;
  scheduledStart: string;
  scheduledEnd?: string;
  timezone: string;
  participantEmails?: string[];
  status: 'scheduled' | 'started' | 'completed' | 'cancelled';
  // Legacy snake_case
  room_name?: string;
  host_id?: string;
  host_name?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  participant_emails?: string[];
}

export interface TokenResponse {
  token: string;
  identity: string;
  name: string;
  roomName: string;
  role: string;
  hostId?: string | null;
  inLobby?: boolean;
  expiresIn: number;
}

export interface ChatMessage {
  id: string;
  senderIdentity: string;
  senderName: string;
  message: string;
  sentAt: Date;
  type: 'chat' | 'system' | 'reaction' | 'private_chat' | 'poll';
  recipientIdentity?: string;
  recipientRole?: 'moderator';
  isPrivate?: boolean;
  poll?: PollData;
  mentions?: string[]; // Array of participant identities mentioned in the message
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // Array of voter identities
}

export interface PollData {
  id: string;
  question: string;
  options: PollOption[];
  allowMultiple: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  isClosed: boolean;
}

export type LayoutMode = 'speaker' | 'grid' | 'spotlight' | 'screenshare' | 'whiteboard';

export type ParticipantRole = 'host' | 'cohost' | 'presenter' | 'attendee' | 'viewer';

// Re-export types from sub-modules
export type {
  AnyParticipant,
  RemoteParticipant,
  LocalParticipant,
  Participant,
  ParticipantPermissions,
  ParticipantUIState,
  ParticipantAction,
  BulkParticipantAction,
} from './participant';

export type {
  RoomStatus,
  CreateRoomPayload,
  RoomState,
  RoomWithParticipants,
  ParticipantInfo,
  LobbyParticipantInfo,
  RoomConfig,
} from './room';

export type {
  RoomParticipant,
  LobbyParticipant,
} from './api';
