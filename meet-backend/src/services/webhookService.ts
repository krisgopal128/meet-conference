import { query } from './database.js';
import {
  addParticipant,
  removeParticipant,
  getParticipantCount,
  getParticipants,
  cacheDel,
} from './redis.js';
import { sendDataMessage } from './livekit.js';
import logger from '../utils/logger.js';

// Types for egress events (not fully defined by LiveKit SDK)
interface EgressFileResult {
  downloadUrl?: string | null;
  filename?: string | null;
}
interface EgressInfo {
  egressId?: string;
  roomName?: string;
  fileResults?: EgressFileResult[];
}

// ============================================
// HOST LEAVE TIMEOUT MANAGEMENT
// ============================================

// Track host leave timeouts - key is roomName, value is NodeJS.Timeout
const hostLeaveTimeouts = new Map<string, NodeJS.Timeout>();
const HOST_REJOIN_GRACE_PERIOD_MS = 240000; // 240 seconds (4 minutes)
const MAX_TIMEOUTS = 500;

// Periodic cleanup of orphaned timeouts (runs every 5 minutes)
const cleanupInterval = setInterval(() => {
  // Cap at MAX_TIMEOUTS to prevent unbounded growth
  if (hostLeaveTimeouts.size > MAX_TIMEOUTS) {
    const excess = hostLeaveTimeouts.size - MAX_TIMEOUTS;
    const keys = Array.from(hostLeaveTimeouts.keys()).slice(0, excess);
    for (const key of keys) {
      const timeout = hostLeaveTimeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
      }
      hostLeaveTimeouts.delete(key);
    }
    logger.warn(`[Webhook] Cleaned ${excess} excess timeouts, remaining: ${hostLeaveTimeouts.size}`);
  }
}, 300_000);

// Cleanup function for graceful shutdown
export function clearAllHostLeaveTimeouts(): void {
  clearInterval(cleanupInterval);
  hostLeaveTimeouts.forEach((timeout) => clearTimeout(timeout));
  hostLeaveTimeouts.clear();
}

/**
 * Schedule a host leave check that transitions room to 'waiting' if host
 * doesn't rejoin within the grace period.
 */
export function scheduleHostLeaveCheck(
  roomName: string,
  hostIdentity: string,
  gracePeriodMs: number,
  onComplete: () => void
): NodeJS.Timeout {
  return setTimeout(async () => {
    try {
      // Double-check host is still not in the room
      const participants = await getParticipants(roomName);
      if (!participants.includes(hostIdentity)) {
        await query(
          "UPDATE rooms SET status = 'waiting' WHERE name = $1 AND status = 'active'",
          [roomName]
        );
      }
    } catch (err) {
      logger.error(`[HostLeave] Error in timeout for room ${roomName}:`, err);
    } finally {
      onComplete();
    }
  }, gracePeriodMs);
}

// ============================================
// WEBHOOK EVENT HANDLERS
// ============================================

export async function handleRoomStarted(roomName: string): Promise<void> {
  // Create meeting record for tracking (only if no ongoing meeting exists for this room)
  await query(
    `INSERT INTO meetings (room_id)
     SELECT id FROM rooms WHERE name = $1
     AND NOT EXISTS (
       SELECT 1 FROM meetings m
       WHERE m.room_id = (SELECT id FROM rooms WHERE name = $1)
       AND m.status = 'ongoing'
     )`,
    [roomName]
  );
}

export async function handleRoomFinished(roomName: string): Promise<void> {
  // Clear any pending host leave timeout
  const existingTimeout = hostLeaveTimeouts.get(roomName);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
    hostLeaveTimeouts.delete(roomName);
  }

  // Mark only the most recent active meeting as ended
  await query(
    `UPDATE meetings 
     SET ended_at = NOW(), status = 'ended'
     WHERE id = (
       SELECT m.id FROM meetings m
       JOIN rooms r ON m.room_id = r.id
       WHERE r.name = $1 AND m.ended_at IS NULL
       ORDER BY m.started_at DESC
       LIMIT 1
     )`,
    [roomName]
  );

  // Update room status
  await query(
    "UPDATE rooms SET status = 'ended' WHERE name = $1",
    [roomName]
  );

  // Clear participant cache (O(1) delete vs N x sRem)
  await cacheDel(`room:${roomName}:participants`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleParticipantJoined(roomName: string, identity: string, _participant?: any): Promise<void> {
  // Track in Redis
  await addParticipant(roomName, identity);

  // Check if this is the host and set room status to active
  const [room] = await query<{ id: string; host_id: string; status: string }>(
    'SELECT id, host_id, status FROM rooms WHERE name = $1',
    [roomName]
  );

  // FALLBACK: Create meeting record if it doesn't exist
  const [existingMeeting] = await query<{ id: string }>(
    `SELECT m.id FROM meetings m
     JOIN rooms r ON m.room_id = r.id
     WHERE r.name = $1 AND m.ended_at IS NULL`,
    [roomName]
  );

  if (!existingMeeting && room) {
    await query(
      `INSERT INTO meetings (room_id) VALUES ($1)`,
      [room.id]
    );
  }

  if (room && room.host_id === identity) {
    // Host has joined - cancel any pending timeout
    const existingTimeout = hostLeaveTimeouts.get(roomName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      hostLeaveTimeouts.delete(roomName);
    }

    // Set room status to active
    await query(
      "UPDATE rooms SET status = 'active' WHERE id = $1",
      [room.id]
    );
  }

  // Get current participant count using O(1) SCARD
  const count = await getParticipantCount(roomName);

  // Update participant count in the most recent active meeting
  await query(
    `UPDATE meetings 
     SET participant_count = $1,
         max_participants = GREATEST(max_participants, $1)
     WHERE id = (
       SELECT m.id FROM meetings m
       JOIN rooms r ON m.room_id = r.id
       WHERE r.name = $2 AND m.ended_at IS NULL
       ORDER BY m.started_at DESC
       LIMIT 1
     )`,
    [count, roomName]
  );

  // Check if participant is a registered user
  const [user] = await query<{ id: string }>(
    'SELECT id FROM users WHERE id = $1',
    [identity]
  );

  // Record participant join
  await query(
    `INSERT INTO meeting_participants (meeting_id, user_id, identity, role)
     SELECT m.id, $1, $2, 
       CASE WHEN r.host_id = $1 THEN 'host' ELSE 'attendee' END
     FROM meetings m
     JOIN rooms r ON r.id = m.room_id
     WHERE r.name = $3 AND m.ended_at IS NULL
     ORDER BY m.started_at DESC
     LIMIT 1
     ON CONFLICT DO NOTHING`,
    [user?.id || null, identity, roomName]
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleParticipantLeft(roomName: string, identity: string, _participant?: any): Promise<void> {
  // Remove from Redis
  await removeParticipant(roomName, identity);

  // Check if this is the host leaving
  const [room] = await query<{ id: string; host_id: string; waiting_room_enabled: boolean }>(
    'SELECT id, host_id, waiting_room_enabled FROM rooms WHERE name = $1',
    [roomName]
  );

  if (room && room.host_id === identity && room.waiting_room_enabled) {
    // Clear any existing timeout first
    const existingTimeout = hostLeaveTimeouts.get(roomName);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule timeout using extracted service function
    const timeout = scheduleHostLeaveCheck(
      roomName,
      identity,
      HOST_REJOIN_GRACE_PERIOD_MS,
      async () => {
        // Only proceed if this timeout is still the current one
        if (hostLeaveTimeouts.get(roomName) !== timeout) return;
        hostLeaveTimeouts.delete(roomName);

        // Send meeting_ended message to all participants
        try {
          const message = new TextEncoder().encode(JSON.stringify({
            type: 'meeting_ended',
            source: 'server',
            message: 'Meeting ended - host did not return',
            reason: 'host_timeout',
          }));
          await sendDataMessage(roomName, message, 'meeting_ended');
        } catch (err) {
          logger.error(`[Webhook] Failed to send meeting_ended to ${roomName}:`, err);
        }

        // End the meeting in database
        try {
          await query(
            `UPDATE meetings SET ended_at = NOW(), status = 'ended' WHERE id = (
              SELECT m.id FROM meetings m JOIN rooms r ON m.room_id = r.id
              WHERE r.name = $1 AND m.ended_at IS NULL ORDER BY m.started_at DESC LIMIT 1
            )`,
            [roomName]
          );
          await query("UPDATE rooms SET status = 'ended' WHERE name = $1", [roomName]);
          await cacheDel(`room:${roomName}:participants`);
        } catch (err) {
          logger.error(`[Webhook] Failed to end meeting for ${roomName}:`, err);
        }
      }
    );

    // Enforce cap at insertion time
    if (hostLeaveTimeouts.size >= MAX_TIMEOUTS) {
      const oldestKey = hostLeaveTimeouts.keys().next().value;
      if (oldestKey) {
        clearTimeout(hostLeaveTimeouts.get(oldestKey)!);
        hostLeaveTimeouts.delete(oldestKey);
      }
    }

    hostLeaveTimeouts.set(roomName, timeout);
  }

  // Update participant count using O(1) SCARD
  const count = await getParticipantCount(roomName);
  await query(
    `UPDATE meetings 
     SET participant_count = $1
     WHERE id = (
       SELECT m.id FROM meetings m
       JOIN rooms r ON m.room_id = r.id
       WHERE r.name = $2 AND m.ended_at IS NULL
       ORDER BY m.started_at DESC
       LIMIT 1
     )`,
    [count, roomName]
  );

  // Record participant leave
  await query(
    `UPDATE meeting_participants 
     SET left_at = NOW()
     WHERE identity = $1 
     AND meeting_id = (
       SELECT m.id FROM meetings m
       JOIN rooms r ON r.id = m.room_id
       WHERE r.name = $2 AND m.ended_at IS NULL
       ORDER BY m.started_at DESC
       LIMIT 1
     )
     AND left_at IS NULL`,
    [identity, roomName]
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEgressStarted(event: any): Promise<void> {
  logger.info(`[Webhook] Recording started: ${event.egressInfo?.egressId} in ${event.egressInfo?.roomName}`);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleEgressEnded(event: any): Promise<void> {
  const egressInfo = event.egressInfo as EgressInfo | undefined;
  if (!egressInfo) return;

  const fileResult = egressInfo.fileResults?.[0];
  const recordingUrl = fileResult?.downloadUrl ?? fileResult?.filename;

  if (recordingUrl) {
    await query(
      `UPDATE meetings 
       SET recording_url = $1
       WHERE id = (
         SELECT m.id FROM meetings m
         JOIN rooms r ON m.room_id = r.id
         WHERE r.name = $2 AND m.ended_at IS NULL
         ORDER BY m.started_at DESC
         LIMIT 1
       )`,
      [recordingUrl, egressInfo.roomName]
    );
  }
}
