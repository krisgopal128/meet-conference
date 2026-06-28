import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { assertFeature } from '../middleware/checkFeatureFlag.js';
import { requireUser } from '../middleware/requireUser.js';
import {
  getParticipantInfo,
  removeParticipant,
  participantCanModerate,
  isModeratorParticipant,
  muteAllAudioTracks,
  muteVideoTrack,
  disableScreenShareTrack,
  listParticipants,
  sendDataMessage,
} from '../services/livekit.js';
import { addKickedParticipant } from '../services/redis.js';
import { processLobbyParticipants } from '../services/lobbyService.js';
import { queryOne } from '../services/database.js';
import logger from '../utils/logger.js';
import * as roomService from '../services/roomService.js';

export const participantsRouter = Router();

async function requireModeratorRoomAccess(roomName: string, userId: string) {
  const room = await roomService.getRoomByName(roomName);

  if (!room) {
    return { room: null, allowed: false as const };
  }

  const allowed = await participantCanModerate(roomName, userId, room.host_id);
  return { room, allowed };
}

async function assertModerator(res: Response, name: string, userId: string, action = 'perform this action') {
  const { room, allowed } = await requireModeratorRoomAccess(name, userId);
  if (!room) { res.status(404).json({ error: 'Room not found' }); return null; }
  if (!allowed) { res.status(403).json({ error: `Only moderators can ${action}` }); return null; }
  return room;
}

async function assertCanTargetModerator(
  res: Response,
  name: string,
  identity: string,
  room: { host_id: string },
  requesterId: string
): Promise<boolean> {
  const participants = await listParticipants(name);
  const target = participants.find(p => p.identity === identity);
  if (target && isModeratorParticipant(target, room.host_id) && requesterId !== room.host_id) {
    res.status(403).json({ error: 'Cannot moderate other moderators' });
    return false;
  }
  return true;
}

async function executeKick(name: string, identity: string) {
  let guestName: string | undefined;
  try {
    const participant = await getParticipantInfo(name, identity);
    guestName = participant.name || undefined;
  } catch { /* participant may have left */ }
  await removeParticipant(name, identity);
  await addKickedParticipant(name, identity, guestName);
}

// DELETE /rooms/:name/participants/:identity - Remove participant from room
participantsRouter.delete('/:name/participants/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can remove participants' });
    }

    // Feature lock: admin may have locked kick for this moderator
    if (await assertFeature(req, res, room.host_id, 'kick')) return;

    if (identity === room.host_id) {
      return res.status(403).json({ error: 'Cannot kick the room host' });
    }

    await executeKick(name, identity);

    res.json({ message: 'Participant removed' });
  } catch (error) {
    logger.error('Kick participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// POST /rooms/:name/mute/:identity - Mute participant's audio
participantsRouter.post('/:name/mute/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, identity } = req.params;

    const room = await assertModerator(res, name, req.user!.id, 'mute participants');
    if (!room) return;

    if (identity === room.host_id && req.user!.id !== room.host_id) {
      return res.status(403).json({ error: 'Cannot mute the room host' });
    }

    if (!(await assertCanTargetModerator(res, name, identity, room, req.user!.id))) return;

    await muteAllAudioTracks(name, identity);
    res.json({ message: 'Participant muted' });
  } catch (error) {
    logger.error('Mute participant error:', error);
    res.status(500).json({ error: 'Failed to mute participant' });
  }
});

// POST /rooms/:name/mute-video/:identity - Mute participant's video (camera)
participantsRouter.post('/:name/mute-video/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, identity } = req.params;

    const room = await assertModerator(res, name, req.user!.id, 'disable cameras');
    if (!room) return;

    if (identity === room.host_id && req.user!.id !== room.host_id) {
      return res.status(403).json({ error: 'Cannot disable the room host\'s camera' });
    }

    if (!(await assertCanTargetModerator(res, name, identity, room, req.user!.id))) return;

    await muteVideoTrack(name, identity);
    res.json({ message: 'Participant camera disabled' });
  } catch (error) {
    logger.error('Mute video error:', error);
    res.status(500).json({ error: 'Failed to disable camera' });
  }
});

// POST /rooms/:name/mute-all - Mute all participants
participantsRouter.post('/:name/mute-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name } = req.params;

    const room = await assertModerator(res, name, req.user!.id, 'mute all participants');
    if (!room) return;

    // Feature lock: admin may have locked mute_all for this moderator
    if (await assertFeature(req, res, room.host_id, 'mute_all')) return;

    // Mute everyone except moderators in parallel
    const participants = await listParticipants(name);
    const nonModerators = participants.filter(p => !isModeratorParticipant(p, room.host_id));
    
    const results = await Promise.allSettled(
      nonModerators.map(p => muteAllAudioTracks(name, p.identity))
    );
    
    const muted = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      logger.warn(`[Mute All] ${failed}/${nonModerators.length} mutes failed`);
    }
    res.json({ message: 'All participants muted', muted, failed });
  } catch (error) {
    logger.error('Mute all error:', error);
    res.status(500).json({ error: 'Failed to mute all participants' });
  }
});

// POST /rooms/:name/kick/:identity - Remove participant from room (alias)
participantsRouter.post('/:name/kick/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (process.env.NODE_ENV === 'development') {
      logger.info(`[KICK] User ${user.id} trying to kick ${identity} from room ${name}`);
      logger.info(`[KICK] Room host_id: ${room.host_id}, User id: ${user.id}`);
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can remove participants' });
    }

    // Feature lock: admin may have locked kick for this moderator
    if (await assertFeature(req, res, room.host_id, 'kick')) return;

    if (identity === room.host_id) {
      return res.status(403).json({ error: 'Cannot kick the room host' });
    }

    await executeKick(name, identity);
    
    res.json({ message: 'Participant removed' });
  } catch (error) {
    logger.error('Kick participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

 // POST /rooms/:name/admit/:identity - Admit participant from lobby
 participantsRouter.post('/:name/admit/:identity', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name, identity } = req.params;

     const room = await roomService.getRoomByName(name);

     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     const allowed = await participantCanModerate(name, user.id, room.host_id);
     if (!allowed) {
       return res.status(403).json({ error: 'Only moderators can admit participants' });
     }

     // Feature lock: admin may have locked lobby_control for this moderator
     if (await assertFeature(req, res, room.host_id, 'lobby_control')) return;

     await processLobbyParticipants(name, [{ identity }], 'admit');
     res.json({ message: 'Participant admitted' });
   } catch (error) {
     logger.error('Admit participant error:', error);
     res.status(500).json({ error: 'Failed to admit participant' });
   }
 });

 // POST /rooms/:name/admit-all - Admit every participant currently waiting in the lobby
 participantsRouter.post('/:name/admit-all', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);

     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     const allowed = await participantCanModerate(name, user.id, room.host_id);
     if (!allowed) {
       return res.status(403).json({ error: 'Only moderators can admit participants' });
     }

     // Feature lock: admin may have locked lobby_control for this moderator
     if (await assertFeature(req, res, room.host_id, 'lobby_control')) return;

     const participants = await listParticipants(name);
     const admitted = await processLobbyParticipants(name, participants, 'admit');

     res.json({ message: 'All lobby participants admitted', count: admitted });
   } catch (error) {
     logger.error('Admit all participants error:', error);
     res.status(500).json({ error: 'Failed to admit all participants' });
   }
 });

 // POST /rooms/:name/deny-all - Remove every participant currently waiting in the lobby
 participantsRouter.post('/:name/deny-all', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);

     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     const allowed = await participantCanModerate(name, user.id, room.host_id);
     if (!allowed) {
       return res.status(403).json({ error: 'Only moderators can deny participants' });
     }

     // Feature lock: admin may have locked lobby_control for this moderator
     if (await assertFeature(req, res, room.host_id, 'lobby_control')) return;

     const participants = await listParticipants(name);
     const denied = await processLobbyParticipants(name, participants, 'deny');

     res.json({ message: 'All lobby participants denied', count: denied });
   } catch (error) {
     logger.error('Deny all participants error:', error);
     res.status(500).json({ error: 'Failed to deny all participants' });
   }
 });

// POST /rooms/:name/disable-screen/:identity - Stop participant screen share
participantsRouter.post('/:name/disable-screen/:identity', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { name, identity } = req.params;

    const { room, allowed } = await requireModeratorRoomAccess(name, user.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (!allowed) {
      return res.status(403).json({ error: 'Only moderators can disable screen share' });
    }

    if (!(await assertCanTargetModerator(res, name, identity, room, user.id))) return;

    await disableScreenShareTrack(name, identity);
    res.json({ message: 'Participant screen share disabled' });
  } catch (error) {
    logger.error('Disable screen share error:', error);
    res.status(500).json({ error: 'Failed to disable screen share' });
  }
});

// POST /rooms/:name/disable-all-cameras - Disable cameras for all non-moderator participants
participantsRouter.post('/:name/disable-all-cameras', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
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
    logger.error('Disable all cameras error:', error);
    res.status(500).json({ error: 'Failed to disable all participant cameras' });
  }
});

 // GET /rooms/:name/lobby - List participants in lobby
 participantsRouter.get('/:name/lobby', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);

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
     logger.error('List lobby error:', error);
     res.status(500).json({ error: 'Failed to list lobby' });
   }
 });

 // GET /rooms/:name/participants - List all participants in room (authenticated only)
 participantsRouter.get('/:name/participants', authenticate, async (req: AuthRequest, res: Response) => {
   try {
     const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     // Check if room exists in database
     const room = await roomService.getRoomByName(name);

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
     logger.error('List participants error:', error);
     res.status(500).json({ error: 'Failed to list participants' });
     }
     });

     // POST /rooms/:name/whiteboard/toggle - Toggle whiteboard (moderator, feature-locked)
     // Server-enforced version of the former P2P 'whiteboard-activate' data message.
     participantsRouter.post('/:name/whiteboard/toggle', authenticate, async (req: AuthRequest, res: Response) => {
     try {
     const user = requireUser(req);
     if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);
     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     const allowed = await participantCanModerate(name, user.id, room.host_id);
     if (!allowed) {
       return res.status(403).json({ error: 'Only moderators can toggle the whiteboard' });
     }

     // Feature lock: admin may have locked whiteboard for this moderator
     if (await assertFeature(req, res, room.host_id, 'whiteboard')) return;

     const { active } = req.body as { active?: boolean };
     const payload = new TextEncoder().encode(JSON.stringify({
       type: 'whiteboard-activate',
       active: active ?? true,
       sentAt: new Date().toISOString(),
     }));

     await sendDataMessage(name, payload, 'whiteboard');

     res.json({ message: 'Whiteboard toggle broadcast', active: active ?? true });
     } catch (error) {
     logger.error('Whiteboard toggle error:', error);
     res.status(500).json({ error: 'Failed to toggle whiteboard' });
     }
     });

     // POST /rooms/:name/lock/toggle - Toggle meeting lock (moderator, feature-locked)
     // Server-enforced version of the former P2P 'meeting_settings_update' for lock.
     participantsRouter.post('/:name/lock/toggle', authenticate, async (req: AuthRequest, res: Response) => {
     try {
     const user = requireUser(req);
     if (!user) return res.status(401).json({ error: 'Authentication required' });
     const { name } = req.params;

     const room = await roomService.getRoomByName(name);
     if (!room) {
       return res.status(404).json({ error: 'Room not found' });
     }

     const allowed = await participantCanModerate(name, user.id, room.host_id);
     if (!allowed) {
       return res.status(403).json({ error: 'Only moderators can lock the meeting' });
     }

     // Feature lock: admin may have locked lock_meeting for this moderator
     if (await assertFeature(req, res, room.host_id, 'lock_meeting')) return;

     const { meetingLocked } = req.body as { meetingLocked?: boolean };

     // Broadcast to all participants (including sender) via server
     const payload = new TextEncoder().encode(JSON.stringify({
       type: 'meeting_settings_update',
       meetingLocked: meetingLocked ?? true,
       sentAt: new Date().toISOString(),
     }));

     await sendDataMessage(name, payload);

     res.json({ message: 'Meeting lock broadcast', meetingLocked: meetingLocked ?? true });
     } catch (error) {
     logger.error('Lock toggle error:', error);
     res.status(500).json({ error: 'Failed to toggle meeting lock' });
     }
     });
