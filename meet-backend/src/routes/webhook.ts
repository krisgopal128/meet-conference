import { Router, Request, Response } from 'express';
import { WebhookEvent } from 'livekit-server-sdk';
import { z } from 'zod';
import { webhookReceiver } from '../services/livekit.js';
import {
  handleRoomStarted,
  handleRoomFinished,
  handleParticipantJoined,
  handleParticipantLeft,
  handleEgressStarted,
  handleEgressEnded,
  clearAllHostLeaveTimeouts,
} from '../services/webhookService.js';
import logger from '../utils/logger.js';

// Re-export so existing imports from routes/webhook.js keep working.
export { clearAllHostLeaveTimeouts };

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

// POST /webhook/livekit - Handle LiveKit webhooks
webhookRouter.post('/', async (req: Request, res: Response) => {
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  const authHeader = req.headers['authorization'] as string;

  let event: WebhookEvent;
  try {
    event = await webhookReceiver.receive(rawBody, authHeader);
  } catch (err) {
    logger.error('[Webhook] Signature verification failed:', err);
    const errorResponse: WebhookErrorResponse = { error: 'Invalid webhook signature' };
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
        if (roomName) {
          await handleRoomStarted(roomName);
        }
        break;
      }

      case 'room_finished': {
        const roomName = event.room?.name;
        if (roomName) {
          await handleRoomFinished(roomName);
        }
        break;
      }

      case 'participant_joined': {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;
        if (roomName && identity) {
          await handleParticipantJoined(roomName, identity, event.participant);
        }
        break;
      }

      case 'participant_left': {
        const roomName = event.room?.name;
        const identity = event.participant?.identity;
        if (roomName && identity) {
          await handleParticipantLeft(roomName, identity, event.participant);
        }
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
        await handleEgressStarted(event);
        break;
      }

      case 'egress_ended': {
        await handleEgressEnded(event);
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
