import {
  AccessToken,
  DataPacket_Kind,
  VideoGrant,
  RoomServiceClient,
  EgressClient,
  WebhookReceiver,
  TrackType,
} from 'livekit-server-sdk';
import { ParticipantInfo, TrackSource } from '@livekit/protocol';
import { config } from '../config.js';
import logger from '../utils/logger.js';

const { apiKey, apiSecret, url } = config.livekit;

// Room Service Client (for room management)
export const roomService = new RoomServiceClient(url, apiKey, apiSecret);

// Egress Client (for recording)
export const egressClient = new EgressClient(url, apiKey, apiSecret);

// Webhook Receiver (for event verification)
export const webhookReceiver = new WebhookReceiver(apiKey, apiSecret);

// Role-based grants
export type ParticipantRole = 'host' | 'cohost' | 'moderator' | 'presenter' | 'attendee' | 'viewer';

const ROLE_GRANTS: Record<ParticipantRole, VideoGrant> = {
  host: {
    roomJoin: true,
    roomCreate: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: true,
    roomRecord: true,
  },
  cohost: {
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: true,
  },
  moderator: {
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: true,
  },
  presenter: {
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  },
  attendee: {
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  },
  viewer: {
    roomJoin: true,
    canPublish: false,
    canSubscribe: true,
    canPublishData: false,
  },
};

/**
 * Generate an access token for a participant
 */
export async function createAccessToken(
  roomName: string,
  identity: string,
  role: ParticipantRole = 'attendee',
  options: {
    name?: string;
    metadata?: string;
    ttl?: number; // seconds
    lobbyMode?: boolean; // Start in lobby (no publish permissions)
  } = {}
): Promise<string> {
  const ttl = options.ttl || 3600; // Default 1 hour
  
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: options.name,
    metadata: options.metadata,
    ttl,
  });

  // Get base grants for role
  const baseGrants = ROLE_GRANTS[role];
  
  // If lobby mode, restrict publish permissions
  const grant: VideoGrant = {
    ...baseGrants,
    room: roomName,
    ...(options.lobbyMode && {
      canPublish: false,
      canPublishData: false,
    }),
  };

  at.addGrant(grant);
  
  return await at.toJwt();
}

/**
 * Create a room with specific configuration
 */
export async function createRoom(
  name: string,
  options: {
    maxParticipants?: number;
    emptyTimeout?: number;
    metadata?: string;
  } = {}
) {
  return roomService.createRoom({
    name,
    maxParticipants: options.maxParticipants || 50,
    emptyTimeout: options.emptyTimeout || 300,
    metadata: options.metadata,
  });
}

/**
 * Get room info
 */
export async function getRoomInfo(roomName: string) {
  try {
    return (await roomService.listRooms([roomName]))[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Delete a room
 */
export async function deleteRoom(roomName: string) {
  return roomService.deleteRoom(roomName);
}

/**
 * List all active rooms
 */
export async function listRooms() {
  return roomService.listRooms();
}

/**
 * List participants in a room
 */
export async function listParticipants(roomName: string) {
  return roomService.listParticipants(roomName);
}

export async function getParticipantInfo(roomName: string, identity: string): Promise<ParticipantInfo> {
  const participant = await roomService.getParticipant(roomName, identity);
  if (!participant) {
    throw new Error('Participant not found');
  }
  return participant;
}

function parseParticipantRole(metadata?: string): ParticipantRole | null {
  if (!metadata) {
    return null;
  }

  try {
    const parsed = JSON.parse(metadata);
    const role = parsed?.role;
    if (role === 'host' || role === 'cohost' || role === 'moderator' || role === 'presenter' || role === 'attendee' || role === 'viewer') {
      return role;
    }
  } catch {
    // Log at debug level for troubleshooting malformed metadata
    if (process.env.NODE_ENV === 'development') {
      logger.warn('[LiveKit] Failed to parse participant metadata:', metadata.slice(0, 100));
    }
  }

  return null;
}

function isModeratorRole(role: ParticipantRole | null | undefined): boolean {
  return role === 'host' || role === 'cohost' || role === 'moderator';
}

export function isModeratorParticipant(participant: ParticipantInfo, roomHostId?: string | null): boolean {
  if (roomHostId && participant.identity === roomHostId) {
    return true;
  }

  return isModeratorRole(parseParticipantRole(participant.metadata));
}

export async function participantCanModerate(
  roomName: string,
  identity: string,
  roomHostId?: string | null
): Promise<boolean> {
  if (roomHostId && identity === roomHostId) {
    return true;
  }

  try {
    const participant = await getParticipantInfo(roomName, identity);
    return isModeratorParticipant(participant, roomHostId);
  } catch {
    return false;
  }
}

function buildPermissionUpdate(
  participant: ParticipantInfo,
  overrides: Partial<NonNullable<ParticipantInfo['permission']>>
) {
  const current = participant.permission;

  return {
    canSubscribe: current?.canSubscribe ?? true,
    canPublish: current?.canPublish ?? true,
    canPublishData: current?.canPublishData ?? true,
    canPublishSources: current?.canPublishSources ?? [],
    hidden: current?.hidden ?? false,
    recorder: current?.recorder ?? false,
    canUpdateMetadata: current?.canUpdateMetadata ?? false,
    agent: current?.agent ?? false,
    canSubscribeMetrics: current?.canSubscribeMetrics ?? false,
    ...overrides,
  };
}

function isMicrophoneTrack(track: ParticipantInfo['tracks'][number]): boolean {
  return track.type === TrackType.AUDIO || track.source === TrackSource.MICROPHONE;
}

function isCameraTrack(track: ParticipantInfo['tracks'][number]): boolean {
  return track.source === TrackSource.CAMERA;
}

function isScreenShareTrack(track: ParticipantInfo['tracks'][number]): boolean {
  return track.source === TrackSource.SCREEN_SHARE || track.source === TrackSource.SCREEN_SHARE_AUDIO;
}

async function muteMatchingTracks(
  roomName: string,
  identity: string,
  participant: ParticipantInfo,
  matcher: (track: ParticipantInfo['tracks'][number]) => boolean,
  label: string
): Promise<number> {
  let mutedCount = 0;

  for (const track of participant.tracks) {
    if (!matcher(track)) {
      continue;
    }

    try {
      await roomService.mutePublishedTrack(roomName, identity, track.sid, true);
      mutedCount++;
    } catch (err) {
      logger.error(`[${label}] Failed to mute track ${track.sid} for ${identity}:`, err);
    }
  }

  if (mutedCount === 0) {
    logger.warn(`[${label}] No matching tracks found for participant ${identity}`);
  }

  return mutedCount;
}


// Per-participant mutex to prevent permission race conditions during concurrent 
// mute/disable operations on the same participant
const participantLocks = new Map<string, Promise<void>>();

async function withParticipantLock<T>(roomName: string, identity: string, fn: () => Promise<T>): Promise<T> {
  const key = `${roomName}:${identity}`;
  const prev = participantLocks.get(key) || Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>(r => { resolve = r; });
  participantLocks.set(key, next);
  
  try {
    await prev; // Wait for any in-flight operation on this participant
    return await fn();
  } finally {
    resolve();
    // Clean up if this is the last operation
    if (participantLocks.get(key) === next) {
      participantLocks.delete(key);
    }
  }
}

/**
 * Temporarily disable publishing for specific track sources, then restore permissions.
 * Consolidated function for microphone, camera, and screen share.
 */
async function temporarilyDisableTrackPublishing(
  roomName: string,
  identity: string,
  participant: ParticipantInfo,
  sourcesToDisable: TrackSource[]
): Promise<void> {
  return withParticipantLock(roomName, identity, async () => {
  const originalPermissions = buildPermissionUpdate(participant, {});
  const currentSources = participant.permission?.canPublishSources ?? [];

  // Check if any of the sources to disable are currently allowed
  const hasSourceToDisable = sourcesToDisable.some(source =>
    currentSources.length === 0 || currentSources.includes(source)
  );

  if (!hasSourceToDisable) {
    return;
  }

  const nextSources = currentSources.length === 0
    ? [TrackSource.MICROPHONE, TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]
        .filter(s => !sourcesToDisable.includes(s))
    : currentSources.filter(source => !sourcesToDisable.includes(source));

  try {
    await roomService.updateParticipant(
      roomName,
      identity,
      undefined,
      {
        ...originalPermissions,
        canPublish: nextSources.length > 0 ? (participant.permission?.canPublish ?? true) : false,
        canPublishSources: nextSources,
      }
    );

    await new Promise((resolve) => setTimeout(resolve, 350));
  } finally {
    await roomService.updateParticipant(roomName, identity, undefined, originalPermissions);
  }
  }); // end withParticipantLock
}

async function temporarilyDisableMicrophonePublishing(
  roomName: string,
  identity: string,
  participant: ParticipantInfo
): Promise<void> {
  return temporarilyDisableTrackPublishing(roomName, identity, participant, [TrackSource.MICROPHONE]);
}

async function temporarilyDisableCameraPublishing(
  roomName: string,
  identity: string,
  participant: ParticipantInfo
): Promise<void> {
  return temporarilyDisableTrackPublishing(roomName, identity, participant, [TrackSource.CAMERA]);
}

async function temporarilyDisableScreenSharePublishing(
  roomName: string,
  identity: string,
  participant: ParticipantInfo
): Promise<void> {
  return temporarilyDisableTrackPublishing(roomName, identity, participant, [TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO]);
}

async function sendParticipantControlSignal(
  roomName: string,
  identity: string,
  action: 'mute_microphone' | 'disable_camera' | 'disable_screenshare'
): Promise<void> {
  const payload = new TextEncoder().encode(JSON.stringify({
    type: 'moderation_control',
    action,
    targetIdentity: identity,
    sentAt: new Date().toISOString(),
  }));

  await roomService.sendData(roomName, payload, DataPacket_Kind.RELIABLE, {
    destinationIdentities: [identity],
    topic: 'moderation_control',
  });
}

/**
 * Send data message to all participants in a room
 */
export async function sendDataMessage(
  roomName: string,
  payload: Uint8Array,
  topic?: string
) {
  await roomService.sendData(roomName, payload, DataPacket_Kind.RELIABLE, {
    topic,
  });
}

/**
 * Remove a participant from a room
 */
export async function removeParticipant(roomName: string, identity: string) {
  return roomService.removeParticipant(roomName, identity);
}

/**
 * Mute all audio tracks for a participant (helper for moderator)
 */
export async function muteAllAudioTracks(roomName: string, identity: string): Promise<void> {
  const participant = await getParticipantInfo(roomName, identity);
  await muteMatchingTracks(roomName, identity, participant, isMicrophoneTrack, 'MUTE');
  await temporarilyDisableMicrophonePublishing(roomName, identity, participant);
  await sendParticipantControlSignal(roomName, identity, 'mute_microphone');
}

/**
 * Mute video track for a participant (helper for moderator)
 */
export async function muteVideoTrack(roomName: string, identity: string): Promise<void> {
  const participant = await getParticipantInfo(roomName, identity);
  await muteMatchingTracks(roomName, identity, participant, isCameraTrack, 'MUTE-VIDEO');
  await temporarilyDisableCameraPublishing(roomName, identity, participant);
  await sendParticipantControlSignal(roomName, identity, 'disable_camera');
}

/**
 * Disable screen share for a participant and prevent immediate republish.
 */
export async function disableScreenShareTrack(roomName: string, identity: string): Promise<void> {
  const participant = await getParticipantInfo(roomName, identity);
  await muteMatchingTracks(roomName, identity, participant, isScreenShareTrack, 'DISABLE-SCREENSHARE');
  await temporarilyDisableScreenSharePublishing(roomName, identity, participant);
  await sendParticipantControlSignal(roomName, identity, 'disable_screenshare');
}

/**
 * Update screen share permissions for all non-moderator participants in a room.
 * When disallowed, restricts canPublishSources to camera/microphone only,
 * preventing screen share tracks from being published.
 */
export async function updateScreenSharePermissions(roomName: string, hostId: string, allowed: boolean): Promise<void> {
  const participants = await listParticipants(roomName);
  for (const p of participants) {
    if (isModeratorParticipant(p, hostId)) {
      continue;
    }
    const permissions = buildPermissionUpdate(p, {
      canPublishSources: allowed ? [] : [TrackSource.CAMERA, TrackSource.MICROPHONE],
    });
    try {
      await roomService.updateParticipant(roomName, p.identity, undefined, permissions);
    } catch (err) {
      logger.error(`[LiveKit] Failed to update screen share permissions for ${p.identity}:`, err);
    }
  }
}

/**
 * Update participant permissions (for lobby admission) - internal helper
 */
async function updateParticipantPermissions(
  roomName: string,
  identity: string,
  permissions: {
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    canPublishSources?: TrackSource[];
    hidden?: boolean;
    recorder?: boolean;
    canUpdateMetadata?: boolean;
    agent?: boolean;
    canSubscribeMetrics?: boolean;
  }
) {
  const participant = await getParticipantInfo(roomName, identity);
  return roomService.updateParticipant(
    roomName,
    identity,
    undefined,
    buildPermissionUpdate(participant, permissions)
  );
}

/**
 * Admit participant from lobby (grant full publish permissions)
 */
export async function admitFromLobby(roomName: string, identity: string) {
  return updateParticipantPermissions(roomName, identity, {
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });
}
