 import { Router, Response } from 'express';
 import { z } from 'zod';
 import crypto from 'crypto';
 import bcrypt from 'bcryptjs';
 import { AuthRequest, authenticate } from '../middleware/authenticate.js';
 import { tokenLimiter } from '../middleware/rateLimiter.js';
import { createAccessToken, ParticipantRole } from '../services/livekit.js';
import { queryOne } from '../services/database.js';
 import * as roomService from '../services/roomService.js';
 import { isParticipantKicked, isGuestNameKicked, isGuestNameAdmitted, cacheDel, cacheIncrWithExpire } from '../services/redis.js';
 import logger from '../utils/logger.js';

 export const tokenRouter = Router();

 // Request may have apiKeyId attached by (hypothetical) middleware
 interface TokenRequest extends AuthRequest {
   apiKeyId?: string | number;
 }

const requestTokenSchema = z.object({
  roomName: z.string().min(1).max(255),
  role: z.enum(['host', 'cohost', 'moderator', 'presenter', 'attendee', 'viewer']).default('attendee'),
  identity: z.string().min(1).max(255).optional(),
  name: z.string().max(255).optional(),
  ttl: z.number().min(60).max(14400).optional(), // 1 min to 4 hours
});

// POST /token - Get LiveKit access token
tokenRouter.post('/', authenticate, tokenLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName, role, identity, name, ttl } = requestTokenSchema.parse(req.body);

     // Use authenticated user's ID as identity if not provided
     const participantIdentity = identity || req.user!.id;
     const participantName = name || req.user!.name || req.user!.email.split('@')[0];

     // Check if room exists in database (optional validation)
     // Include waiting_room_enabled in initial query to avoid double query
     const room = await roomService.getRoomByName(roomName);

     // If room exists and is ended, only host can restart
     if (room && room.status === 'ended') {
      if (room.host_id !== req.user!.id) {
        return res.status(400).json({ error: 'Room has ended. Only the host can restart the meeting.' });
      }
      // Host is restarting - reset status to 'waiting' immediately
      // This prevents race conditions where other checks see 'ended' status
      await queryOne(
        "UPDATE rooms SET status = 'waiting' WHERE name = $1",
        [roomName]
      );
      // Invalidate cached room data so subsequent requests see 'waiting' status
      try { await cacheDel(`room:${roomName}`); } catch { /* cache del best effort */ }
      logger.info(`[Token] Host ${req.user!.id} restarting room ${roomName}, status reset to 'waiting'`);
    }

    // Determine the actual role - room creator is always host
    let actualRole = role;
    let isHost = false;
    let isModerator = false;
    if (room && room.host_id === req.user!.id) {
      actualRole = 'host';
      isHost = true;
    } else if (room && room.host_id !== req.user!.id) {
      // Check if user is co-host (stored permissions)
      const participant = await queryOne<{ role: string }>(
        'SELECT role FROM meeting_participants WHERE meeting_id = (SELECT id FROM meetings WHERE room_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1) AND user_id = $2 AND left_at IS NULL ORDER BY joined_at DESC LIMIT 1',
        [room.id, req.user!.id]
      );
      isModerator = participant?.role === 'host' || participant?.role === 'moderator';
    }

    // If user claims host role, verify they are the host
    if (role === 'host' && room && room.host_id !== req.user!.id) {
      return res.status(403).json({ error: 'Only the room creator can be host' });
    }

    // If user requests moderator role, verify they are host or co-host
    if (role === 'moderator' && !isHost && !isModerator) {
      // User is not host nor co-host - check if API key was used for this session
       const apiKeyUsed = (req as TokenRequest).apiKeyId;
      if (apiKeyUsed) {
        // API key was used - fall back to attendee
        actualRole = 'attendee';
      } else {
        // For regular authenticated users without moderator permissions, also fall back
        actualRole = 'attendee';
        logger.info(`[Token] User ${req.user!.id} requested moderator but not authorized, falling back to attendee`);
      }
    }

    // Check if participant was recently kicked (non-hosts only)
    // Use req.user!.id (authenticated) not participantIdentity (user-supplied) to prevent kick bypass
    if (!isHost) {
      const kickedTTL = await isParticipantKicked(roomName, req.user!.id);
      if (kickedTTL > 0) {
        return res.status(429).json({ 
          error: `You were recently removed from this meeting. Please wait ${kickedTTL} seconds before rejoining.`,
          retryAfter: kickedTTL 
        });
      }
    }

    // Check waiting room status for non-hosts (no extra query needed)
    let inLobby = false;
    if (!isHost && room) {
      // If waiting room enabled, always put non-hosts in lobby for moderator approval
      inLobby = room.waiting_room_enabled === true;
    }

    // Generate LiveKit access token
    const accessToken = await createAccessToken(roomName, participantIdentity, actualRole as ParticipantRole, {
      name: participantName,
      metadata: JSON.stringify({
        role: actualRole,
        inLobby,
      }),
      ttl,
      // Override permissions for lobby
      lobbyMode: inLobby,
    });

    res.json({
      token: accessToken,
      identity: participantIdentity,
      name: participantName,
      roomName,
      role: actualRole,
      hostId: room?.host_id || null,
      inLobby,
      expiresIn: ttl || 3600,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    // Log error type only, not message (could contain sensitive data)
    logger.error('Token generation failed:', error instanceof Error ? error.constructor.name : 'Unknown error type');
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

// POST /token/guest - Get token for guest users (no auth required)
tokenRouter.post('/guest', tokenLimiter, async (req, res: Response) => {
  try {
    const guestSchema = z.object({
      roomName: z.string().min(1).max(255),
      name: z.string().min(1).max(255),
      role: z.enum(['attendee', 'viewer']).default('attendee'),
      password: z.string().max(255).optional(),
    });

    const { roomName, name, role, password } = guestSchema.parse(req.body);

    // Check if room exists in database
    const room = await roomService.getRoomByName(roomName);

    if (!room) {
      return res.status(404).json({ error: 'Room not found. The room must be created before guests can join.' });
    }

    if (room.status === 'ended') {
      return res.status(400).json({ error: 'Room has ended. Please wait for the host to restart the meeting.' });
    }

    // Verify room password if required (fetched via dedicated query to avoid leaking hash)
    const roomPasswordHash = await roomService.getRoomPasswordHash(roomName);
    if (roomPasswordHash) {
      // Rate limit password attempts (per IP + room) to prevent brute force
      const attemptsKey = `room_pwd_attempts:${roomName}:${req.ip}`;
      let attempts = 0;
      try {
        attempts = await cacheIncrWithExpire(attemptsKey, 300);
      } catch {
        // Redis unavailable - allow attempt
      }
      if (attempts > 10) {
        return res.status(429).json({ error: 'Too many password attempts. Try again later.' });
      }

      if (!password) {
        return res.status(401).json({ error: 'Room password required' });
      }
      const validPassword = await bcrypt.compare(password, roomPasswordHash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid room password' });
      }

      // Reset attempts on successful password verification
      try { await cacheDel(attemptsKey); } catch { /* best effort */ }
    }

    // Check if this guest name was recently kicked from this room
    // Redis is best-effort here — if it's temporarily unavailable, allow the join
    let kickedTTL = 0;
    try {
      kickedTTL = await isGuestNameKicked(roomName, name);
    } catch {
      logger.warn('[Token] Redis unavailable for kick check, allowing guest join');
    }
    if (kickedTTL > 0) {
      return res.status(429).json({ 
        error: `You were recently removed from this meeting. Please wait ${kickedTTL} seconds before rejoining.`,
        retryAfter: kickedTTL 
      });
    }

    // Generate a guest identity using cryptographically secure random (no timestamp to avoid predictability)
    const guestIdentity = `guest_${crypto.randomBytes(16).toString('hex')}`;

    // Check if this guest was previously admitted (auto-admit on rejoin)
    let wasPreviouslyAdmitted = 0;
    try {
      wasPreviouslyAdmitted = await isGuestNameAdmitted(roomName, name);
    } catch {
      logger.warn('[Token] Redis unavailable for admit check, treating as new guest');
    }
    
    // If waiting room is enabled, guests go to lobby for moderator approval
    // UNLESS they were previously admitted (reconnecting after disconnect)
    const inLobby = room?.waiting_room_enabled === true && !wasPreviouslyAdmitted;

    // Generate token with appropriate permissions
    const accessToken = await createAccessToken(roomName, guestIdentity, role as ParticipantRole, {
      name,
      metadata: JSON.stringify({ guest: true, inLobby, wasPreviouslyAdmitted }),
      ttl: 3600, // 1 hour for guests
      // Override permissions for lobby
      lobbyMode: inLobby,
    });

    res.json({
      token: accessToken,
      identity: guestIdentity,
      name,
      roomName,
      role,
      hostId: room?.host_id || null,
      inLobby,
      wasPreviouslyAdmitted,
      expiresIn: 3600,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    // Log error details for debugging
    logger.error('Guest token generation failed:', error instanceof Error ? { name: error.constructor.name, message: error.message, stack: error.stack?.substring(0, 300) } : 'Unknown error type');
    res.status(500).json({ error: 'Failed to generate guest token' });
  }
});
