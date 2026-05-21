/**
 * Prashasakah Rooms Routes
 *
 * Admin room management: list, detail, end, delete.
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireAdmin, requireModerator } from '../../middleware/requireRole.js';
import { query, queryOne } from '../../services/database.js';
import logger from '../../utils/logger.js';
import { adminActionLimiter } from './rateLimiter.js';

const router = Router();

// ============================================
// Row type interfaces
// ============================================

interface RoomRow {
  id: string;
  name: string;
  title: string;
  description: string | null;
  host_id: string;
  host_name: string | null;
  status: string;
  max_participants: number;
  waiting_room_enabled: boolean;
  created_at: Date;
  starts_at: Date | null;
  participant_count: number;
}

interface RoomDetailRow {
  id: string;
  name: string;
  title: string;
  description: string | null;
  host_id: string;
  host_name: string | null;
  host_email: string | null;
  status: string;
  max_participants: number;
  waiting_room_enabled: boolean;
  created_at: Date;
  starts_at: Date | null;
}

// ============================================
// Rooms Management (Admin)
// ============================================

router.get('/rooms', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR title ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const rooms = await query<RoomRow>(`
      SELECT r.id, r.name, r.title, r.description, r.host_id, u.name as host_name,
        r.status, r.max_participants, r.waiting_room_enabled, r.created_at,
        r.starts_at,
        (SELECT COUNT(*) FROM meeting_participants mp 
         JOIN meetings m ON m.id = mp.meeting_id 
         WHERE m.room_id = r.id AND mp.left_at IS NULL) as participant_count
      FROM rooms r
      LEFT JOIN users u ON u.id = r.host_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const totalResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM rooms ${whereClause}
    `, params);

     res.json({
       rooms: rooms.map((r) => ({
         id: r.id,
         name: r.name,
         title: r.title,
         description: r.description,
         hostId: r.host_id,
         hostName: r.host_name,
         status: r.status,
         maxParticipants: r.max_participants,
         waitingRoomEnabled: r.waiting_room_enabled,
         createdAt: r.created_at,
       })),
      total: Number(totalResult?.count || 0),
      hasMore: Number(totalResult?.count || 0) > offset + limit,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

router.get('/rooms/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await queryOne<RoomDetailRow>(`
      SELECT r.id, r.name, r.title, r.description, r.host_id, u.name as host_name, u.email as host_email,
        r.status, r.max_participants, r.waiting_room_enabled, r.created_at, r.starts_at
      FROM rooms r
      LEFT JOIN users u ON u.id = r.host_id
      WHERE r.id = $1
    `, [id]);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      room: {
        id: room.id,
        name: room.name,
        title: room.title,
        description: room.description,
        hostId: room.host_id,
        hostName: room.host_name,
        hostEmail: room.host_email,
        status: room.status,
        maxParticipants: room.max_participants,
        waitingRoomEnabled: room.waiting_room_enabled,
        createdAt: room.created_at,
        startedAt: room.starts_at,
      },
    });
  } catch (error) {
    logger.error('[Admin] Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

router.post('/rooms/:id/end', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE rooms SET status = 'ended' WHERE id = $1
    `, [id]);

    // Also update any active meetings
    await query(`
      UPDATE meetings SET status = 'ended', ended_at = NOW()
      WHERE room_id = $1 AND status = 'ongoing'
    `, [id]);

    logger.info(`[Admin] Room ${id} ended by ${req.user?.id}`);

    res.json({ message: 'Room ended successfully' });
  } catch (error) {
    logger.error('[Admin] Error ending room:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

router.delete('/rooms/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM rooms WHERE id = $1', [id]);
    logger.info(`[Admin] Room ${id} deleted by ${req.user?.id}`);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    logger.error('[Admin] Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;
