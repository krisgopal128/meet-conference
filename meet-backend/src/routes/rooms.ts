import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { AuthRequest, authenticate, optionalAuth } from '../middleware/authenticate.js';
import { requireUser } from '../middleware/requireUser.js';
import {
  createRoom as createLiveKitRoom,
  listRooms,
  getRoomInfo,
  deleteRoom,
  listParticipants,
  participantCanModerate,
} from '../services/livekit.js';
import { getCached, invalidatePattern, TTL_SHORT } from '../services/cache.js';
import { sanitizeRoomName, sanitizeDescription } from '../utils/validation.js';
import logger from '../utils/logger.js';
import * as roomService from '../services/roomService.js';
import type { RoomRow } from '../services/roomService.js';
import { participantsRouter } from './roomsParticipants.js';
import { chatRouter } from './roomsChat.js';

export const roomsRouter = Router();

// Enriched room with active status
interface EnrichedRoom extends RoomRow {
  isActive: boolean;
}

const createRoomSchema = z.object({
  name: z.string().min(3).max(100),
  title: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
  password: z.string().max(255).optional(),
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
  waitingRoomEnabled: z.boolean().optional(),
});

 // POST /rooms - Create a new room
 roomsRouter.post('/', authenticate, async (req: AuthRequest, res: Response) => {
   try {
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
      const roomPassword = data.password?.trim();
      const roomPasswordHash = roomPassword ? await bcrypt.hash(roomPassword, 12) : null;

      // Check if room name already exists
     const exists = await roomService.roomExists(roomName);
     if (exists) {
       return res.status(409).json({ error: 'Room name already exists' });
     }

      // Create room in database
      const room = await roomService.createRoom(
          roomName,
          req.user!.id,
          data.title || null,
         description,
         roomPasswordHash,
         data.maxParticipants,
         data.emptyTimeout,
         data.startsAt ? new Date(data.startsAt) : null,
         data.endsAt ? new Date(data.endsAt) : null,
         data.settings || null,
         data.waitingRoomEnabled
      );

      // Optionally create room in LiveKit (auto_create: false in config)
      // We create it here to set limits
      try {
        await createLiveKitRoom(roomName, {
          maxParticipants: data.maxParticipants,
          emptyTimeout: data.emptyTimeout,
           metadata: JSON.stringify({ title: data.title, hostId: req.user!.id }),
        });
      } catch (lkError) {
        logger.warn('LiveKit room creation failed (may already exist):', lkError);
      }

       res.status(201).json({ room });

       // Invalidate room list caches
       invalidatePattern('cache:rooms:*').catch(() => {});
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Validation error', details: error.errors });
        }
        if (error instanceof roomService.RoomServiceError && error.code === 'DUPLICATE_NAME') {
          return res.status(409).json({ error: 'Room name already exists' });
        }
        logger.error('Create room error:', error);
        res.status(500).json({ error: 'Failed to create room' });
      }
   });

   // GET /rooms - List all rooms (user's rooms or all active)
   roomsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
     try {
       const { all } = req.query;
       const allFlag = all === 'true' ? 'true' : 'false';

       const result = await getCached<{ rooms: unknown[] }>(
          `cache:rooms:list:${req.user!.id}:${allFlag}`,
         TTL_SHORT,
         async () => {
           let rooms: RoomRow[];
           if (all === 'true') {
             rooms = await roomService.getAllRooms();
           } else {
             rooms = await roomService.getUserRooms(req.user!.id);
           }

           // Get active rooms from LiveKit
           const activeRooms = await listRooms();
           const activeRoomNames = new Set(activeRooms.map(r => r.name));

           // Merge with database rooms
           const enrichedRooms: EnrichedRoom[] = rooms.map((room) => ({
             ...room,
             isActive: activeRoomNames.has(room.name),
           }));

           return { rooms: enrichedRooms };
         },
       );

       res.json(result);
     } catch (error) {
       logger.error('List rooms error:', error);
       res.status(500).json({ error: 'Failed to list rooms' });
     }
   });

 // GET /rooms/:name - Get room details (authenticated - protects room metadata)
 roomsRouter.get('/:name', optionalAuth, async (req: AuthRequest, res: Response) => {
   try {
     const { name } = req.params;
     const isAuthenticated = !!req.user;

     const room = await roomService.getRoomByName(name, true);

     // Get LiveKit room info regardless of database status
     let lkRoom = null;
     let participants: unknown[] = [];
     try {
       const lkRooms = await getRoomInfo(name);
       lkRoom = lkRooms || null;
       if (lkRoom) {
         participants = await listParticipants(name);
       }
     } catch {
       // Room may not exist in LiveKit yet
     }

     // If room exists in LiveKit but not in database, create a virtual room object
     // This allows participants to join rooms created directly in LiveKit
     if (!room && lkRoom) {
       const virtualRoom = roomService.createVirtualRoom(name, lkRoom, isAuthenticated);
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
     logger.error('Get room error:', error);
     res.status(500).json({ error: 'Failed to get room' });
   }
 });

 // PATCH /rooms/:name - Update room
 roomsRouter.patch('/:name', authenticate, async (req: AuthRequest, res: Response) => {
   try {
      const { name } = req.params;
      const data = updateRoomSchema.parse(req.body);

      const room = await roomService.getRoomByName(name);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.host_id !== req.user!.id) {
        return res.status(403).json({ error: 'Only the host can update this room' });
      }

      const updated = await roomService.updateRoom(name, {
        title: data.title,
        description: data.description,
        maxParticipants: data.maxParticipants,
        status: data.status,
        waitingRoomEnabled: data.waitingRoomEnabled,
      });

      // Invalidate room caches
      await invalidatePattern('cache:rooms:*');

      res.json({ room: updated });
   } catch (error) {
     if (error instanceof z.ZodError) {
       return res.status(400).json({ error: 'Validation error', details: error.errors });
     }
     logger.error('Update room error:', error);
     res.status(500).json({ error: 'Failed to update room' });
   }
 });

 // DELETE /rooms/:name - Delete room
 roomsRouter.delete('/:name', authenticate, async (req: AuthRequest, res: Response) => {
   try {
      const { name } = req.params;

      const room = await roomService.getRoomByName(name);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      if (room.host_id !== req.user!.id) {
        return res.status(403).json({ error: 'Only the host can delete this room' });
      }

      // Delete from LiveKit
      try {
        await deleteRoom(name);
      } catch {
        // Room may not exist
      }

       // Delete from database
       await roomService.deleteRoomByName(name);

       // Invalidate room caches
       await invalidatePattern('cache:rooms:*');
       await invalidatePattern('cache:meetings:*');

       res.json({ message: 'Room deleted' });
    } catch (error) {
      logger.error('Delete room error:', error);
      res.status(500).json({ error: 'Failed to delete room' });
    }
  });

// Mount participant management and chat sub-routers (paths remain relative to /rooms)
roomsRouter.use(participantsRouter);
roomsRouter.use(chatRouter);

 // POST /rooms/:name/start - Start the meeting (host only)
 roomsRouter.post('/:name/start', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);

     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     if (room.host_id !== user.id) {
       return res.status(403).json({ error: 'Only the host can start the meeting' });
     }

     // Check if there's an actual active meeting (not just room status)
     // This allows moderator to restart meeting after page refresh/disconnect
     const activeMeeting = await roomService.hasActiveMeeting(room.id);

     if (activeMeeting) {
       // Meeting already running - just return success (idempotent)
       return res.json({ message: 'Meeting already active', status: 'active' });
     }

     // Update room status to active
     await roomService.setRoomActive(room.id);

       // Create a new meeting record
       const meetingId = await roomService.createMeeting(room.id);

       // Invalidate caches on meeting start
       invalidatePattern('cache:rooms:*').catch(() => {});
       invalidatePattern('cache:meetings:*').catch(() => {});
       invalidatePattern('cache:stats:*').catch(() => {});

       res.json({ message: 'Meeting started', status: 'active', meetingId });
    } catch (error) {
      logger.error('Start meeting error:', error);
      res.status(500).json({ error: 'Failed to start meeting' });
    }
  });

 // POST /rooms/:name/end - End the meeting (host only)
 roomsRouter.post('/:name/end', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);

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
     await roomService.endRoomMeetings(room.id);

     // Update room status
     await roomService.setRoomEnded(room.id);

     // Delete room from LiveKit to disconnect all participants
     try {
       await deleteRoom(name);
     } catch {
       // Room may not exist
     }

       res.json({ message: 'Meeting ended', status: 'ended' });

       // Invalidate caches on meeting end
       invalidatePattern('cache:rooms:*').catch(() => {});
       invalidatePattern('cache:meetings:*').catch(() => {});
       invalidatePattern('cache:stats:*').catch(() => {});
    } catch (error) {
      logger.error('End meeting error:', error);
      res.status(500).json({ error: 'Failed to end meeting' });
    }
  });

// Room settings schema
const roomSettingsSchema = z.object({
  gridAspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', 'none']).optional(),
  videoFitMode: z.enum(['cover', 'contain']).optional(),
  meetingLocked: z.boolean().optional(),
  participantsCanShareScreen: z.boolean().optional(),
  participantsCanChat: z.boolean().optional(),
  participantsCanUnmute: z.boolean().optional(),
  participantsCanTurnOnCamera: z.boolean().optional(),
  faceCrop: z.object({
    enabled: z.boolean(),
    aspectRatio: z.enum(['16:9', '9:16', '1:1', '4:3', 'none']),
    model: z.enum(['tiny', 'ssd']),
  }).optional(),
});

 // GET /rooms/:name/settings - Get room settings (public)
 roomsRouter.get('/:name/settings', optionalAuth, async (req, res: Response) => {
   try {
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);

     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     // Return settings or defaults
       const settings = room.settings || {
         gridAspectRatio: '16:9',
         videoFitMode: 'cover',
         meetingLocked: false,
         participantsCanShareScreen: true,
         participantsCanChat: true,
         participantsCanUnmute: true,
         participantsCanTurnOnCamera: true,
         faceCrop: {
           enabled: false,
           aspectRatio: '16:9',
           model: 'tiny',
         },
      };

      res.json({ settings });
    } catch (error) {
      logger.error('Get room settings error:', error);
      res.status(500).json({ error: 'Failed to get room settings' });
    }
  });

 // PUT /rooms/:name/settings - Update room settings (moderator only)
 roomsRouter.put('/:name/settings', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;
     const data = roomSettingsSchema.parse(req.body);

     const room = await roomService.getRoomByName(name);

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

     await roomService.updateRoomSettings(room.id, newSettings);

     res.json({ settings: newSettings });
   } catch (error) {
     if (error instanceof z.ZodError) {
       return res.status(400).json({ error: 'Validation error', details: error.errors });
     }
     logger.error('Update room settings error:', error);
     res.status(500).json({ error: 'Failed to update room settings' });
   }
 });
