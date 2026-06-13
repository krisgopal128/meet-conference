import { Router } from 'express';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { participantCanModerate } from '../services/livekit.js';
import { queryOne, query } from '../services/database.js';
import * as roomService from '../services/roomService.js';
import logger from '../utils/logger.js';

export const whiteboardRouter = Router();

/**
 * GET /whiteboard/:roomName
 * Fetch the persisted whiteboard scene + lock status for a room.
 */
whiteboardRouter.get('/:roomName', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomName } = req.params;
    const room = await roomService.getRoomByName(roomName);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const row = await queryOne<{
      scene: string;
      locked: boolean;
      updated_at: string;
    }>(
      'SELECT scene, locked, updated_at FROM whiteboards WHERE room_name = $1',
      [roomName],
    );

    if (!row) {
      // Default: locked=true (moderator-only edit)
      res.json({ scene: [], locked: true, updated_at: null });
      return;
    }

    res.json({ scene: row.scene, locked: row.locked, updated_at: row.updated_at });
  } catch (err) {
    logger.error('Failed to fetch whiteboard', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /whiteboard/:roomName
 * Save (upsert) the whiteboard scene for a room.
 */
whiteboardRouter.put('/:roomName', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomName } = req.params;
    const { scene } = req.body;

    if (!Array.isArray(scene)) {
      res.status(400).json({ error: 'scene must be an array' });
      return;
    }

    // Limit scene size to 1MB
    const sceneJson = JSON.stringify(scene);
    if (sceneJson.length > 1_000_000) {
      res.status(413).json({ error: 'Scene too large (max 1MB)' });
      return;
    }

    const room = await roomService.getRoomByName(roomName);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    const canModerate = room.host_id === req.user!.id
      ? true
      : await participantCanModerate(roomName, req.user!.id, room.host_id);

    // Verify user is host or participant of this room
    const isHost = room.host_id === req.user!.id;
    if (!isHost) {
      const participant = await queryOne(
        'SELECT mp.id FROM meeting_participants mp JOIN meetings m ON mp.meeting_id = m.id JOIN rooms r ON m.room_id = r.id WHERE r.name = $1 AND mp.user_id = $2 LIMIT 1',
        [roomName, req.user!.id]
      );
      if (!participant) {
        res.status(403).json({ error: 'You must be a participant of this room to edit the whiteboard' });
        return;
      }
    }

    const existingWhiteboard = await queryOne<{ locked: boolean }>(
      'SELECT locked FROM whiteboards WHERE room_name = $1',
      [roomName],
    );

    const isLocked = existingWhiteboard?.locked ?? true;
    if (isLocked && !canModerate) {
      res.status(403).json({ error: 'Whiteboard is locked. Only room moderators can edit it.' });
      return;
    }

    await query(
      `INSERT INTO whiteboards (room_name, scene, locked, updated_at)
       VALUES ($1, $2, true, now())
       ON CONFLICT (room_name)
       DO UPDATE SET scene = $2, updated_at = now(), locked = whiteboards.locked`,
      [roomName, sceneJson],
    );

    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to save whiteboard', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /whiteboard/:roomName/lock
 * Toggle whiteboard lock status. Only moderators/admins can toggle.
 * Body: { locked: boolean }
 */
whiteboardRouter.patch('/:roomName/lock', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomName } = req.params;
    const { locked } = req.body;

    if (typeof locked !== 'boolean') {
      res.status(400).json({ error: 'locked must be a boolean' });
      return;
    }

    const room = await roomService.getRoomByName(roomName);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Verify user is a room moderator (host/cohost via LiveKit metadata)
    const canMod = await participantCanModerate(roomName, req.user!.id, room.host_id);
    if (!canMod) {
      // Fallback: allow system admins too
      const isHost = room.host_id === req.user!.id;
      if (!isHost) {
        return res.status(403).json({ error: 'Only room moderators can toggle whiteboard lock' });
      }
    }

    await query(
      `INSERT INTO whiteboards (room_name, scene, locked, updated_at)
       VALUES ($1, '[]'::jsonb, $2, now())
       ON CONFLICT (room_name)
       DO UPDATE SET locked = $2, updated_at = now()`,
      [roomName, locked],
    );

    res.json({ ok: true, locked });
  } catch (err) {
    logger.error('Failed to toggle whiteboard lock', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /whiteboard/:roomName
 * Clear the persisted whiteboard scene.
 */
whiteboardRouter.delete('/:roomName', authenticate, async (req: AuthRequest, res) => {
  try {
    const { roomName } = req.params;
    const room = await roomService.getRoomByName(roomName);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Verify user is a room moderator
    const canMod = await participantCanModerate(roomName, req.user!.id, room.host_id);
    if (!canMod) {
      const isHost = room.host_id === req.user!.id;
      if (!isHost) {
        return res.status(403).json({ error: 'Only room moderators can clear the whiteboard' });
      }
    }

    await query('DELETE FROM whiteboards WHERE room_name = $1', [roomName]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete whiteboard', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});
