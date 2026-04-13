import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest, authenticate, optionalAuth } from '../middleware/authenticate.js';
import { requireUser } from '../middleware/requireUser.js';
import { query, queryOne } from '../services/database.js';
import { 
  createRoom, 
  listRooms, 
  getRoomInfo, 
  deleteRoom, 
  listParticipants,
  removeParticipant,
  participantCanModerate,
  isModeratorParticipant,
  muteAllAudioTracks,
  muteVideoTrack,
  disableScreenShareTrack,
} from '../services/livekit.js';
import { addKickedParticipant } from '../services/redis.js';
import { processLobbyParticipants } from '../services/lobbyService.js';
import { sanitizeRoomName, sanitizeDescription, sanitizeChatMessage } from '../utils/validation.js';

export const roomsRouter = Router();

async function requireModeratorRoomAccess(roomName: string, userId: string) {
  const room = await queryOne<{ host_id: string }>(
    'SELECT host_id FROM rooms WHERE name = $1',
    [roomName]
  );

  if (!room) {
    return { room: null, allowed: false as const };
  }

  const allowed = await participantCanModerate(roomName, userId, room.host_id);
  return { room, allowed };
}

async function canAccessRoomChat(roomName: string, userId: string) {
  const room = await queryOne<{ id: string; host_id: string }>(
    'SELECT id, host_id FROM rooms WHERE name = $1',
    [roomName]
  );

  if (!room) {
    return { room: null, allowed: false as const };
  }

  if (room.host_id === userId) {
    return { room, allowed: true as const };
  }

  // Check DB for active meeting participation instead of LiveKit API call
  const participant = await queryOne<{ identity: string }>(
    `SELECT mp.identity 
     FROM meeting_participants mp
     JOIN meetings m ON m.id = mp.meeting_id
     WHERE m.room_id = $1 AND mp.user_id = $2 AND mp.left_at IS NULL
     ORDER BY m.started_at DESC LIMIT 1`,
    [room.id, userId]
  );

  return {
    room,
    allowed: !!participant,
  };
}

// Interface for room data from database
interface RoomRow {
  id: string;
  name: string;
  title: string | null;
  description: string | null;
  host_id: string;
  host_name?: string;
  host_email?: string;
  max_participants: number;
  status: string;
  created_at: Date;
}

// Enriched room with active status
interface EnrichedRoom extends RoomRow {
  isActive: boolean;
}

const createRoomSchema = z.object({
  name: z.string().min(3).max(100),
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  maxParticipants: z.number().min(2).max(100).default(50),
  emptyTimeout: z.number().min(60).max(3600).default(300),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  waitingRoomEnabled: z.boolean().default(true),
  settings: z.object({
    faceCrop: z.object({
      enabled: z.boolean().default(false),
      aspectRatio: z.enum(['none', '16:9', '9:16', '1:1', '4:3']).default('none'),
      model: z.enum(['tiny', 'ssd']).default('tiny'),
    }).optional(),
  }).optional(),
});

const updateRoomSchema = z.object({
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  maxParticipants: z.number().min(2).max(100).optional(),
  status: z.enum(['waiting', 'active', 'ended']).optional(),
});

// POST /rooms - Create a new room
roomsRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const data = createRoomSchema.parse(req.body);
    
    // Sanitize room name
    let roomName: string;
    try {
      roomName = sanitizeRoomName(data.name);
    } catch (validationError) {
      return res.status(400).json({ 
        error: validationError instanceof Error ? validationError.message : 'Invalid room name' 
      });
    }
    
    // Sanitize description if provided
    const description = data.description ? sanitizeDescription(data.description) : null;

    // Check if room name already exists
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM rooms WHERE name = $1',
      [roomName]
    );

    if (existing) {
      return res.status(409).json({ error: 'Room name already exists' });
    }

    // Create room in database
    const [room] = await query<{
      id: string;
      name: string;
      title: string | null;
      description: string | null;
      host_id: string;
      max_participants: number;
      status: string;
      created_at: Date;
    }>(
      `INSERT INTO rooms (name, title, description, host_id, max_participants, empty_timeout, starts_at, ends_at, settings, waiting_room_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, title, description, host_id, max_participants, status, created_at`,
      [
        roomName,
        data.title || null,
        description,
        user.id,
        data.maxParticipants,
        data.emptyTimeout,
        data.startsAt ? new Date(data.startsAt) : null,
        data.endsAt ? new Date(data.endsAt) : null,
        data.settings ? JSON.stringify(data.settings) : null,
        data.waitingRoomEnabled,
      ]
    );

    // Optionally create room in LiveKit (auto_create: false in config)
    // We create it here to set limits
    try {
      await createRoom(roomName, {
        maxParticipants: data.maxParticipants,
        emptyTimeout: data.emptyTimeout,
        metadata: JSON.stringify({ title: data.title, hostId: user.id }),
      });
    } catch (lkError) {
      console.warn('LiveKit room creation failed (may already exist):', lkError);
    }

    res.status(201).json({ room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// GET /rooms - List all rooms (user's rooms or all active)
roomsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { all } = req.query;

    let rooms: RoomRow[];
    if (all === 'true') {
      // Get all rooms
      rooms = await query<RoomRow>(
        `SELECT r.*, u.name as host_name, u.email as host_email
         FROM rooms r
         LEFT JOIN users u ON r.host_id = u.id
         ORDER BY r.created_at DESC
         LIMIT 100`
      );
    } else {
      // Get user's rooms
      rooms = await query<RoomRow>(
        `SELECT r.*, u.name as host_name, u.email as host_email
         FROM rooms r
         LEFT JOIN users u ON r.host_id = u.id
         WHERE r.host_id = $1
         ORDER BY r.created_at DESC
         LIMIT 50`,
        [user.id]
      );
    }

    // Get active rooms from LiveKit
    const activeRooms = await listRooms();
    const activeRoomNames = new Set(activeRooms.map(r => r.name));

    // Merge with database rooms
    const enrichedRooms: EnrichedRoom[] = rooms.map((room) => ({
      ...room,
      isActive: activeRoomNames.has(room.name),
    }));

    res.json({ rooms: enrichedRooms });
  } catch (error) {
    console.error('List rooms error:', error);
    res.status(500).json({ error: 'Failed to list rooms' });
  }
});

// GET /rooms/:name - Get room details (authenticated - protects room metadata)
roomsRouter.get('/:name', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;
    const isAuthenticated = !!req.user;

    const room = await queryOne<{
      id: string;
      name: string;
      title: string | null;
      description: string | null;
      host_id: string;
      max_participants: number;
      status: string;
      metadata: object;
      created_at: Date;
    }>(
      `SELECT r.*, u.name as host_name, u.email as host_email
       FROM rooms r
       LEFT JOIN users u ON r.host_id = u.id
       WHERE r.name = $1`,
      [name]
    );

    // Get LiveKit room info regardless of database status
    let lkRoom = null;
    let participants: unknown[] = [];
    try {
      const lkRooms = await getRoomInfo(name);
      lkRoom = lkRooms?.[0] || null;
      if (lkRoom) {
        participants = await listParticipants(name);
      }
    } catch {
      // Room may not exist in LiveKit yet
    }

    // If room exists in LiveKit but not in database, create a virtual room object
    // This allows participants to join rooms created directly in LiveKit
    if (!room && lkRoom) {
      const virtualRoom = {
        id: `lk-${name}`,
        name: name,
        title: null,
        description: null,
        host_id: isAuthenticated ? 'livekit' : undefined,
        host_name: null,
        host_email: null,
        max_participants: lkRoom.maxParticipants || 50,
        status: 'active',
        metadata: lkRoom.metadata || {},
        created_at: new Date(),
      };
      return res.json({
        room: virtualRoom,
        livekit: isAuthenticated ? lkRoom : { status: 'active' },
        participants: isAuthenticated ? participants : participants.length,
      });
    }

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // For unauthenticated requests, return limited room info
    if (!isAuthenticated) {
      res.json({
        room: {
          id: room.id,
          name: room.name,
          title: room.title,
          description: room.description,
          max_participants: room.max_participants,
          status: room.status,
          created_at: room.created_at,
        },
        livekit: lkRoom ? { status: 'active' } : null,
        participants: participants.length,
      });
    } else {
      res.json({
        room,
        livekit: lkRoom,
        participants,
      });
    }
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

// PATCH /rooms/:name - Update room
roomsRouter.patch('/:name', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;
    const data = updateRoomSchema.parse(req.body);

    const room = await queryOne<{ id: string; host_id: string }>(
      'SELECT id, host_id FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host_id !== user.id) {
      return res.status(403).json({ error: 'Only the host can update this room' });
    }

    const [updated] = await query(
      `UPDATE rooms
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           max_participants = COALESCE($3, max_participants),
           status = COALESCE($4, status)
       WHERE name = $5
       RETURNING *`,
      [data.title, data.description, data.maxParticipants, data.status, name]
    );

    res.json({ room: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// DELETE /rooms/:name - Delete room
roomsRouter.delete('/:name', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const room = await queryOne<{ id: string; host_id: string }>(
      'SELECT id, host_id FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host_id !== user.id) {
      return res.status(403).json({ error: 'Only the host can delete this room' });
    }

    // Delete from LiveKit
    try {
      await deleteRoom(name);
    } catch {
      // Room may not exist
    }

    // Delete from database
    await query('DELETE FROM rooms WHERE id = $1', [room.id]);

    res.json({ message: 'Room deleted' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// DELETE /rooms/:name/participants/:identity - Remove participant from room
roomsRouter.delete('/:name/participants/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can remove participants' });
    }

    await removeParticipant(name, identity);
    res.json({ message: 'Participant removed' });
  } catch (error) {
    console.error('Kick participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// POST /rooms/:name/mute/:identity - Mute participant's audio
roomsRouter.post('/:name/mute/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can mute participants' });
    }

    await muteAllAudioTracks(name, identity);
    res.json({ message: 'Participant muted' });
  } catch (error) {
    console.error('Mute participant error:', error);
    res.status(500).json({ error: 'Failed to mute participant' });
  }
});

// POST /rooms/:name/mute-video/:identity - Mute participant's video (camera)
roomsRouter.post('/:name/mute-video/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can disable cameras' });
    }

    await muteVideoTrack(name, identity);
    res.json({ message: 'Participant camera disabled' });
  } catch (error) {
    console.error('Mute video error:', error);
    res.status(500).json({ error: 'Failed to disable camera' });
  }
});

// POST /rooms/:name/mute-all - Mute all participants
roomsRouter.post('/:name/mute-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can mute all participants' });
    }

    // Mute everyone except moderators in parallel
    const participants = await listParticipants(name);
    const nonModerators = participants.filter(p => !isModeratorParticipant(p, room.host_id));
    
    const results = await Promise.allSettled(
      nonModerators.map(p => muteAllAudioTracks(name, p.identity))
    );
    
    const muted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      console.warn(`[Mute All] ${failed}/${nonModerators.length} mutes failed`);
    }
    res.json({ message: 'All participants muted', muted, failed });
  } catch (error) {
    console.error('Mute all error:', error);
    res.status(500).json({ error: 'Failed to mute all participants' });
  }
});

// POST /rooms/:name/kick/:identity - Remove participant from room (alias)
roomsRouter.post('/:name/kick/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[KICK] User ${user.id} trying to kick ${identity} from room ${name}`);
      console.log(`[KICK] Room host_id: ${room.host_id}, User id: ${user.id}`);
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can remove participants' });
    }

    // Get participant info to extract name for guest tracking
    const participants = await listParticipants(name);
    const participant = participants.find(p => p.identity === identity);
    const guestName = participant?.name || undefined;
    
    await removeParticipant(name, identity);
    
    // Add to kicked list with 10-second cooldown
    await addKickedParticipant(name, identity, guestName);
    
    res.json({ message: 'Participant removed' });
  } catch (error) {
    console.error('Kick participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// POST /rooms/:name/admit/:identity - Admit participant from lobby
roomsRouter.post('/:name/admit/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name, identity } = req.params;

    const room = await queryOne<{ host_id: string; waiting_room_enabled: boolean }>(
      'SELECT host_id, waiting_room_enabled FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const allowed = await participantCanModerate(name, user.id, room.host_id);
    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can admit participants' });
    }

    await processLobbyParticipants(name, [{ identity }], 'admit');
    res.json({ message: 'Participant admitted' });
  } catch (error) {
    console.error('Admit participant error:', error);
    res.status(500).json({ error: 'Failed to admit participant' });
  }
});

// POST /rooms/:name/admit-all - Admit every participant currently waiting in the lobby
roomsRouter.post('/:name/admit-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const room = await queryOne<{ host_id: string }>(
      'SELECT host_id FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const allowed = await participantCanModerate(name, user.id, room.host_id);
    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can admit participants' });
    }

    const participants = await listParticipants(name);
    const admitted = await processLobbyParticipants(name, participants, 'admit');

    res.json({ message: 'All lobby participants admitted', count: admitted });
  } catch (error) {
    console.error('Admit all participants error:', error);
    res.status(500).json({ error: 'Failed to admit all participants' });
  }
});

// POST /rooms/:name/deny-all - Remove every participant currently waiting in the lobby
roomsRouter.post('/:name/deny-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const room = await queryOne<{ host_id: string }>(
      'SELECT host_id FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const allowed = await participantCanModerate(name, user.id, room.host_id);
    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can deny participants' });
    }

    const participants = await listParticipants(name);
    const denied = await processLobbyParticipants(name, participants, 'deny');

    res.json({ message: 'All lobby participants denied', count: denied });
  } catch (error) {
    console.error('Deny all participants error:', error);
    res.status(500).json({ error: 'Failed to deny all participants' });
  }
});

// POST /rooms/:name/disable-screen/:identity - Stop participant screen share
roomsRouter.post('/:name/disable-screen/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can disable screen share' });
    }

    await disableScreenShareTrack(name, identity);
    res.json({ message: 'Participant screen share disabled' });
  } catch (error) {
    console.error('Disable screen share error:', error);
    res.status(500).json({ error: 'Failed to disable screen share' });
  }
});

// POST /rooms/:name/disable-all-cameras - Disable cameras for all non-moderator participants
roomsRouter.post('/:name/disable-all-cameras', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can disable all cameras' });
    }

    const participants = await listParticipants(name);
    const nonModerators = participants.filter(p => !isModeratorParticipant(p, room.host_id));

    // Disable all cameras in parallel
    const results = await Promise.allSettled(
      nonModerators.map(p => muteVideoTrack(name, p.identity))
    );
    const disabled = results.filter(r => r.status === 'fulfilled').length;

    res.json({ message: 'All participant cameras disabled', count: disabled });
  } catch (error) {
    console.error('Disable all cameras error:', error);
    res.status(500).json({ error: 'Failed to disable all participant cameras' });
  }
});

// POST /rooms/:name/start - Start the meeting (host only)
roomsRouter.post('/:name/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const room = await queryOne<{ id: string; host_id: string; status: string }>(
      'SELECT id, host_id, status FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host_id !== user.id) {
      return res.status(403).json({ error: 'Only the host can start the meeting' });
    }

    // Check if there's an actual active meeting (not just room status)
    // This allows moderator to restart meeting after page refresh/disconnect
    const activeMeeting = await queryOne<{ id: string }>(
      'SELECT id FROM meetings WHERE room_id = $1 AND ended_at IS NULL',
      [room.id]
    );

    if (activeMeeting) {
      // Meeting already running - just return success (idempotent)
      return res.json({ message: 'Meeting already active', status: 'active', meetingId: activeMeeting.id });
    }

    // Update room status to active
    await query(
      "UPDATE rooms SET status = 'active' WHERE id = $1",
      [room.id]
    );

    // Create a new meeting record
    const [newMeeting] = await query<{ id: string }>(
      'INSERT INTO meetings (room_id) VALUES ($1) RETURNING id',
      [room.id]
    );

    res.json({ message: 'Meeting started', status: 'active', meetingId: newMeeting.id });
  } catch (error) {
    console.error('Start meeting error:', error);
    res.status(500).json({ error: 'Failed to start meeting' });
  }
});

// POST /rooms/:name/end - End the meeting (host only)
roomsRouter.post('/:name/end', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const room = await queryOne<{ id: string; host_id: string; status: string }>(
      'SELECT id, host_id, status FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host_id !== user.id) {
      return res.status(403).json({ error: 'Only the host can end the meeting' });
    }

    if (room.status !== 'active') {
      return res.status(400).json({ error: 'Meeting is not active' });
    }

    // End any active meetings
    await query(
      'UPDATE meetings SET ended_at = NOW() WHERE room_id = $1 AND ended_at IS NULL',
      [room.id]
    );

    // Update room status
    await query(
      "UPDATE rooms SET status = 'ended' WHERE id = $1",
      [room.id]
    );

    // Delete room from LiveKit to disconnect all participants
    try {
      await deleteRoom(name);
    } catch {
      // Room may not exist
    }

    res.json({ message: 'Meeting ended', status: 'ended' });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ error: 'Failed to end meeting' });
  }
});

// GET /rooms/:name/lobby - List participants in lobby
roomsRouter.get('/:name/lobby', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    const room = await queryOne<{ host_id: string; waiting_room_enabled: boolean }>(
      'SELECT host_id, waiting_room_enabled FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const allowed = await participantCanModerate(name, user.id, room.host_id);
    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can view lobby' });
    }

    // Get all participants and filter those in lobby (can't publish)
    const participants = await listParticipants(name);
    const lobbyParticipants = participants.filter(p => !p.permission?.canPublish);

    res.json({ lobby: lobbyParticipants });
  } catch (error) {
    console.error('List lobby error:', error);
    res.status(500).json({ error: 'Failed to list lobby' });
  }
});

// GET /rooms/:name/chat - Get room chat history across all sessions of the room
roomsRouter.get('/:name/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;
    const { limit = 200 } = req.query;
    const parsedLimit = Math.min(parseInt(limit as string, 10) || 200, 500);

    const { room, allowed } = await canAccessRoomChat(name, user.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only active participants or the host can view room chat history' });
    }

    const messages = await query(
      `SELECT cm.id,
              cm.content,
              cm.created_at,
              cm.message_type,
              COALESCE(u.id::text, mp.identity) as sender_identity,
              COALESCE(u.name, mp.identity) as sender_name
       FROM chat_messages cm
       JOIN meetings m ON m.id = cm.meeting_id
       LEFT JOIN users u ON u.id = cm.user_id
       LEFT JOIN meeting_participants mp ON mp.meeting_id = cm.meeting_id AND mp.user_id = cm.user_id
       WHERE m.room_id = $1
       ORDER BY cm.created_at ASC
       LIMIT $2`,
      [room.id, parsedLimit]
    );

    res.json({ messages });
  } catch (error) {
    console.error('Get room chat history error:', error);
    res.status(500).json({ error: 'Failed to get room chat history' });
  }
});

// POST /rooms/:name/chat - Persist a chat message for the latest room session
roomsRouter.post('/:name/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;
    const { content, messageType = 'text' } = req.body;

    // Sanitize chat message
    let sanitizedContent: string;
    try {
      sanitizedContent = sanitizeChatMessage(content);
    } catch (validationError) {
      return res.status(400).json({ 
        error: validationError instanceof Error ? validationError.message : 'Invalid message content' 
      });
    }

    const { room, allowed } = await canAccessRoomChat(name, user.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only active participants or the host can send room chat messages' });
    }

    const latestMeeting = await queryOne<{ id: string }>(
      `SELECT id
       FROM meetings
       WHERE room_id = $1
       ORDER BY started_at DESC
       LIMIT 1`,
      [room.id]
    );

    if (!latestMeeting) {
      return res.status(409).json({ error: 'No active or historical meeting session found for this room yet' });
    }

    const [message] = await query<{
      id: string;
      content: string;
      created_at: Date;
      message_type: string;
    }>(
      `INSERT INTO chat_messages (meeting_id, user_id, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, created_at, message_type`,
      [latestMeeting.id, user.id, sanitizedContent, messageType]
    );

    res.status(201).json({
      message: {
        ...message,
        senderIdentity: user.id,
        senderName: user.name ?? user.email.split('@')[0],
      },
    });
  } catch (error) {
    console.error('Persist room chat message error:', error);
    res.status(500).json({ error: 'Failed to persist room chat message' });
  }
});

// GET /rooms/:name/participants - List all participants in room (authenticated only)
roomsRouter.get('/:name/participants', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;

    // Check if room exists in database
    const room = await queryOne<{ id: string; host_id: string }>(
      'SELECT id, host_id FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Only host and participants can view the participant list
    if (room.host_id !== user.id) {
      // Check if user is an active participant
      const isParticipant = await queryOne<{ identity: string }>(
        `SELECT mp.identity 
         FROM meeting_participants mp
         JOIN meetings m ON m.id = mp.meeting_id
         WHERE m.room_id = $1 AND mp.user_id = $2 AND mp.left_at IS NULL
         ORDER BY m.started_at DESC LIMIT 1`,
        [room.id, user.id]
      );

      if (!isParticipant) {
        return res.status(403).json({ error: 'Only participants can view the participant list' });
      }
    }

    // Get participants from LiveKit
    const participants = await listParticipants(name);

    res.json({ participants });
  } catch (error) {
    console.error('List participants error:', error);
    res.status(500).json({ error: 'Failed to list participants' });
  }
});

// Room settings schema
const roomSettingsSchema = z.object({
  gridAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', 'none']).optional(),
  videoFitMode: z.enum(['cover', 'contain']).optional(),
  faceCrop: z.object({
    enabled: z.boolean(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', 'none']),
    model: z.enum(['tiny', 'ssd']),
  }).optional(),
});

// GET /rooms/:name/settings - Get room settings (public)
roomsRouter.get('/:name/settings', async (req, res: Response) => {
  try {
    const { name } = req.params;

    const room = await queryOne<{ 
      id: string; 
      settings: object | null;
    }>(
      'SELECT id, settings FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Return settings or defaults
    const settings = room.settings || {
      gridAspectRatio: '16:9',
      videoFitMode: 'cover',
      faceCrop: {
        enabled: false,
        aspectRatio: '16:9',
        model: 'tiny',
      },
    };

    res.json({ settings });
  } catch (error) {
    console.error('Get room settings error:', error);
    res.status(500).json({ error: 'Failed to get room settings' });
  }
});

// PUT /rooms/:name/settings - Update room settings (moderator only)
roomsRouter.put('/:name/settings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    const { name } = req.params;
    const data = roomSettingsSchema.parse(req.body);

    const room = await queryOne<{ id: string; host_id: string; settings: object | null }>(
      'SELECT id, host_id, settings FROM rooms WHERE name = $1',
      [name]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const allowed = await participantCanModerate(name, user.id, room.host_id);
    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can update room settings' });
    }

    // Merge with existing settings
    const currentSettings = room.settings || {};
    const newSettings = { ...currentSettings, ...data };

    await query(
      'UPDATE rooms SET settings = $1 WHERE id = $2',
      [JSON.stringify(newSettings), room.id]
    );

    res.json({ settings: newSettings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Update room settings error:', error);
    res.status(500).json({ error: 'Failed to update room settings' });
  }
});
