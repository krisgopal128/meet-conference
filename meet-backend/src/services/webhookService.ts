import { query } from './database.js';
import {
  addParticipant,
  removeParticipant,
  getParticipantCount,
  getParticipants,
  cacheDel,
  setHostLeaveMarker,
  isHostLeaveMarkerActive,
  clearHostLeaveMarker,
  publishHostLeaveCancel,
  subscribeHostLeaveCancels,
} from './redis.js';
import { sendDataMessage } from './livekit.js';
import { invalidatePattern } from './cache.js';
import logger from '../utils/logger.js';
import { z } from 'zod';

const egressStartedSchema = z.object({
  event: z.literal('egress_started'),
  egressInfo: z.object({
    egressId: z.string(),
    roomName: z.string(),
    status: z.string(),
  }).passthrough(),
}).passthrough();

const egressEndedSchema = z.object({
  event: z.literal('egress_ended'),
  egressInfo: z.object({
    egressId: z.string(),
    roomName: z.string(),
    status: z.string(),
    fileResults: z.array(z.object({
      filename: z.string(),
      downloadUrl: z.string().url().optional(),
    })).optional(),
  }).passthrough(),
}).passthrough();

// ============================================
// HOST LEAVE TIMEOUT MANAGEMENT
// ============================================

// Track host leave timeouts. The Node timer is per-instance (timers can't
// run across processes), but the Redis marker (see redis.ts) is the single
// source of truth for whether the host is still gone. We also keep the
// per-room pub/sub unsubscribe so we can clean up the subscriber on
// shutdown or when a new timer replaces an old one.
interface HostLeaveEntry {
  timer: NodeJS.Timeout;
  unsubscribe: (() => Promise<void>) | null;
}
const hostLeaveTimeouts = new Map<string, HostLeaveEntry>();
const HOST_REJOIN_GRACE_PERIOD_MS = 240000; // 240 seconds (4 minutes)
const MAX_TIMEOUTS = 500;

// Periodic cleanup of orphaned timeouts (runs every 5 minutes)
const cleanupInterval = setInterval(() => {
  // Cap at MAX_TIMEOUTS to prevent unbounded growth
  if (hostLeaveTimeouts.size > MAX_TIMEOUTS) {
    const excess = hostLeaveTimeouts.size - MAX_TIMEOUTS;
    const keys = Array.from(hostLeaveTimeouts.keys()).slice(0, excess);
    for (const key of keys) {
      const entry = hostLeaveTimeouts.get(key);
      if (entry) {
        clearTimeout(entry.timer);
        entry.unsubscribe?.().catch(() => {});
      }
      hostLeaveTimeouts.delete(key);
    }
    logger.warn(`[Webhook] Cleaned ${excess} excess timeouts, remaining: ${hostLeaveTimeouts.size}`);
  }
}, 300_000);

// Cleanup function for graceful shutdown
export function clearAllHostLeaveTimeouts(): void {
  clearInterval(cleanupInterval);
  for (const entry of hostLeaveTimeouts.values()) {
    clearTimeout(entry.timer);
    entry.unsubscribe?.().catch(() => {});
  }
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
  // Create meeting record idempotently. The partial unique index
  // `idx_meetings_one_active_per_room` (see schema.sql) guarantees only one
  // ongoing meeting per room, so ON CONFLICT DO NOTHING is race-safe.
  await query(
    `INSERT INTO meetings (room_id)
     SELECT id FROM rooms WHERE name = $1
     ON CONFLICT DO NOTHING`,
    [roomName]
  );

  // Invalidate admin caches so new meeting shows immediately
  await invalidatePattern('cache:meetings:*');
  await invalidatePattern('cache:stats:*');
}

export async function handleRoomFinished(roomName: string): Promise<void> {
  // Clear any pending host leave timeout
  const existing = hostLeaveTimeouts.get(roomName);
  if (existing) {
    clearTimeout(existing.timer);
    existing.unsubscribe?.().catch(() => {});
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

  // Invalidate admin caches so ended meeting/room shows immediately
  await invalidatePattern('cache:meetings:*');
  await invalidatePattern('cache:rooms:*');
  await invalidatePattern('cache:stats:*');
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

  // FALLBACK: Create meeting record if it doesn't exist.
  // The partial unique index `idx_meetings_one_active_per_room` makes this
  // ON CONFLICT DO NOTHING race-safe across concurrent webhook deliveries.
  if (room) {
    await query(
      `INSERT INTO meetings (room_id) VALUES ($1)
       ON CONFLICT DO NOTHING`,
      [room.id]
    );
  }

  if (room && room.host_id === identity) {
    // Host has joined - cancel any pending timeout on this instance
    const existing = hostLeaveTimeouts.get(roomName);
    if (existing) {
      clearTimeout(existing.timer);
      existing.unsubscribe?.().catch(() => {});
      hostLeaveTimeouts.delete(roomName);
    }

    // Clear the Redis marker (single source of truth) and notify any other
    // instance that may own a local timer for this room. The owner will
    // re-check the marker when its timer fires and abort.
    try {
      await clearHostLeaveMarker(roomName);
      await publishHostLeaveCancel(roomName);
    } catch (err) {
      logger.warn(`[Webhook] Failed to clear/publish host_leave cancel for ${roomName} (continuing):`, err);
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

  // Check if participant is a registered user.
  // Identity may be a non-UUID guest_*** string; guard the UUID column lookup
  // to avoid Postgres error 22P02 (invalid input syntax for type uuid),
  // which would crash the whole webhook handler for guest joins.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let user: { id: string } | undefined;
  if (UUID_RE.test(identity)) {
    [user] = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [identity]
    );
  }

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

  // Invalidate admin caches so updated participant count shows immediately
  await invalidatePattern('cache:meetings:*');
  await invalidatePattern('cache:stats:*');
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

  if (room && room.host_id === identity) {
    // Clear any existing entry first (timer + subscriber)
    const existing = hostLeaveTimeouts.get(roomName);
    if (existing) {
      clearTimeout(existing.timer);
      existing.unsubscribe?.().catch(() => {});
    }

    // Set Redis marker — single source of truth across instances.
    // The marker expires after the grace period even if this instance crashes.
    // The local timer still fires the end-meeting logic; the marker lets
    // (a) other instances know to cancel the action, and
    // (b) this instance know on re-check that the timer was the right one.
    try {
      await setHostLeaveMarker(
        roomName,
        identity,
        Math.ceil(HOST_REJOIN_GRACE_PERIOD_MS / 1000),
      );
    } catch (err) {
      logger.warn(`[Webhook] Failed to set host_leave marker for ${roomName} (continuing):`, err);
    }

    // Subscribe to the cancel channel so this instance can react when a peer
    // instance (the one processing the host's participant_joined) tells us to
    // abort. Subscribe BEFORE scheduling the timer to avoid a race.
    let unsubscribe: (() => Promise<void>) | null = null;
    try {
      unsubscribe = await subscribeHostLeaveCancels(roomName, () => {
        const entry = hostLeaveTimeouts.get(roomName);
        if (entry) {
          clearTimeout(entry.timer);
          entry.unsubscribe?.().catch(() => {});
          hostLeaveTimeouts.delete(roomName);
          logger.info(`[Webhook] Peer cancelled host-leave timer for ${roomName}`);
        }
      });
    } catch (err) {
      logger.warn(`[Webhook] Failed to subscribe to host_leave cancel for ${roomName} (continuing):`, err);
    }

    // Schedule timeout using extracted service function
    const timer = scheduleHostLeaveCheck(
      roomName,
      identity,
      HOST_REJOIN_GRACE_PERIOD_MS,
      async () => {
        // Only proceed if this entry is still the current one
        const entry = hostLeaveTimeouts.get(roomName);
        if (!entry || entry.timer !== timer) return;
        hostLeaveTimeouts.delete(roomName);
        entry.unsubscribe?.().catch(() => {});

        // Re-check the Redis marker. If another instance cleared it (host
        // rejoined on a different instance), the host is back — abort.
        let stillGone = true;
        try {
          stillGone = await isHostLeaveMarkerActive(roomName);
        } catch (err) {
          logger.warn(`[Webhook] Marker check failed for ${roomName}, proceeding with end-meeting:`, err);
        }
        if (!stillGone) {
          logger.info(`[Webhook] Host returned to ${roomName} on another instance; cancelling timeout.`);
          return;
        }

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
        const oldest = hostLeaveTimeouts.get(oldestKey);
        if (oldest) {
          clearTimeout(oldest.timer);
          oldest.unsubscribe?.().catch(() => {});
        }
        hostLeaveTimeouts.delete(oldestKey);
      }
    }

    hostLeaveTimeouts.set(roomName, { timer, unsubscribe });
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
       JOIN rooms r ON m.room_id = r.id
       WHERE r.name = $2 AND m.ended_at IS NULL
       ORDER BY m.started_at DESC
       LIMIT 1
     )
     AND left_at IS NULL`,
    [identity, roomName]
  );

  // Invalidate admin caches so updated participant count shows immediately
  await invalidatePattern('cache:meetings:*');
  await invalidatePattern('cache:stats:*');
}

export async function handleEgressStarted(event: unknown): Promise<void> {
  const parsed = egressStartedSchema.safeParse(event);
  if (!parsed.success) {
    logger.warn('[Webhook] Invalid egress_started event structure, skipping:', parsed.error.message);
    return;
  }
  const { egressInfo } = parsed.data;
  logger.info(`[Webhook] Recording started: ${egressInfo.egressId} in ${egressInfo.roomName}`);
}

export async function handleEgressEnded(event: unknown): Promise<void> {
  const parsed = egressEndedSchema.safeParse(event);
  if (!parsed.success) {
    logger.warn('[Webhook] Invalid egress_ended event structure, skipping:', parsed.error.message);
    return;
  }

  const { egressInfo } = parsed.data;
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
