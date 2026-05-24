import { Router } from 'express';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { requireModerator } from '../middleware/requireRole.js';
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
      'SELECT scene, locked, updated_at FROM whiteboards WHERE room_id = $1',
      [room.id],
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

    await query(
      `INSERT INTO whiteboards (room_id, scene, locked, updated_at)
       VALUES ($1, $2, true, now())
       ON CONFLICT (room_id)
       DO UPDATE SET scene = $2, updated_at = now(), locked = whiteboards.locked`,
      [room.id, sceneJson],
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
whiteboardRouter.patch('/:roomName/lock', authenticate, requireModerator(), async (req: AuthRequest, res) => {
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

    await query(
      `INSERT INTO whiteboards (room_id, scene, locked, updated_at)
       VALUES ($1, '[]'::jsonb, $2, now())
       ON CONFLICT (room_id)
       DO UPDATE SET locked = $2, updated_at = now()`,
      [room.id, locked],
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
whiteboardRouter.delete('/:roomName', authenticate, requireModerator(), async (req: AuthRequest, res) => {
  try {
    const { roomName } = req.params;
    const room = await roomService.getRoomByName(roomName);

    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    await query('DELETE FROM whiteboards WHERE room_id = $1', [room.id]);
    res.json({ ok: true });
  } catch (err) {
    logger.error('Failed to delete whiteboard', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
});
