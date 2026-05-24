 import { Router, Request, Response } from 'express';
 import { WebhookEvent } from 'livekit-server-sdk';
 import { z } from 'zod';
 import { webhookReceiver } from '../services/livekit.js';
 import { query } from '../services/database.js';
 import { addParticipant, removeParticipant, getParticipantCount, cacheDel } from '../services/redis.js';
 import { scheduleHostLeaveCheck } from '../services/webhookService.js';
 import { sendDataMessage } from '../services/livekit.js';
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

 export const webhookRouter = Router();

// ==================== Validation Schemas ====================

/**
 * LiveKit webhook event types (subset we handle)
 */
const webhookEventSchema = z.discriminatedUnion('event', [
  z.object({ event: z.literal('room_started'), room: z.object({ name: z.string() }).optional() }),
  z.object({ event: z.literal('room_finished'), room: z.object({ name: z.string() }).optional() }),
  z.object({ 
    event: z.literal('participant_joined'), 
    room: z.object({ name: z.string() }).optional(),
    participant: z.object({ identity: z.string() }).optional(),
  }),
  z.object({ 
    event: z.literal('participant_left'), 
    room: z.object({ name: z.string() }).optional(),
    participant: z.object({ identity: z.string() }).optional(),
  }),
  z.object({ event: z.literal('track_published') }),
  z.object({ event: z.literal('track_unpublished') }),
  z.object({ event: z.literal('egress_started') }),
  z.object({ event: z.literal('egress_ended') }),
]);

// ==================== Response Types ====================

interface WebhookSuccessResponse {
  received: boolean;
}

interface WebhookErrorResponse {
  error: string;
  details?: string;
}

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

// Export cleanup function for graceful shutdown
export function clearAllHostLeaveTimeouts(): void {
  clearInterval(cleanupInterval);
  hostLeaveTimeouts.forEach((timeout) => clearTimeout(timeout));
  hostLeaveTimeouts.clear();
}

// POST /webhook/livekit - Handle LiveKit webhooks
webhookRouter.post('/', async (req: Request, res: Response) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  const authHeader = req.headers['authorization'] as string;

  let event: WebhookEvent;
  try {
    event = await webhookReceiver.receive(rawBody, authHeader);
  } catch (err) {
    logger.error('[Webhook] Signature verification failed:', err);
    const errorResponse: WebhookErrorResponse = { 
      error: 'Invalid webhook signature',
      details: err instanceof Error ? err.message : 'Unknown error'
    };
    return res.status(401).json(errorResponse);
  }

  // Validate event structure (additional safety check after SDK parsing)
  const eventValidation = webhookEventSchema.safeParse(event);
  if (!eventValidation.success) {
    logger.warn('[Webhook] Unrecognized event type:', event.event);
    // Still return 200 for unknown events - LiveKit shouldn't retry
    const response: WebhookSuccessResponse = { received: true };
    return res.status(200).json(response);
  }

  try {
    switch (event.event) {
      case 'room_started': {
        const roomName = event.room?.name;
        if (!roomName) break;

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
        break;
      }

      case 'room_finished': {
        const roomName = event.room?.name;
        if (!roomName) break;

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
        break;
      }

      case 'participant_joined': {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;
        if (!roomName || !identity) break;

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
        break;
      }

      case 'participant_left': {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;
        if (!roomName || !identity) break;

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
        break;
      }

      case 'track_published':
      case 'track_unpublished': {
        // Reduced logging - only log in development
        if (process.env.NODE_ENV === 'development') {
          logger.info(`[Webhook] ${event.event}: ${event.track?.sid} by ${event.participant?.identity}`);
        }
        break;
      }

      case 'egress_started': {
        logger.info(`[Webhook] Recording started: ${event.egressInfo?.egressId} in ${event.egressInfo?.roomName}`);
        break;
      }

      case 'egress_ended': {
         const egressInfo = event.egressInfo as EgressInfo | undefined;
         if (!egressInfo) break;

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
        break;
      }

      default:
        // Silently ignore unhandled events to reduce log noise
        break;
    }
  } catch (dbError) {
    logger.error('[Webhook] DB error:', dbError);
    // Still return 200 so LiveKit doesn't retry
  }

  res.status(200).json({ received: true } as WebhookSuccessResponse);
});
