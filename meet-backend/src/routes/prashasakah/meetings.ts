/**
 * Prashasakah Meetings Routes
 *
 * Admin meeting management: list, detail, chat.
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireModerator } from '../../middleware/requireRole.js';
import { query, queryOne } from '../../services/database.js';
import logger from '../../utils/logger.js';

const router = Router();

// ============================================
// Row type interfaces
// ============================================

interface MeetingRow {
  id: string;
  room_id: string;
  room_name: string;
  room_title: string;
  host_id: string;
  host_name: string;
  participant_count: number;
  started_at: Date;
  ended_at: Date | null;
  status: string;
  recording_url: string | null;
}

interface ParticipantRow {
  user_id: string;
  name: string | null;
  email: string | null;
  joined_at: Date;
  left_at: Date | null;
}

interface ChatMessageRow {
  id: string;
  content: string;
  created_at: Date;
  message_type: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
}

// ============================================
// Meetings Management (Admin)
// ============================================

router.get('/meetings', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const roomId = req.query.roomId as string | undefined;
    const roomName = req.query.roomName as string | undefined;
    const hostId = req.query.hostId as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (roomId) {
      whereClause += ` AND m.room_id = $${paramIndex}`;
      params.push(roomId);
      paramIndex++;
    }

    if (roomName) {
      whereClause += ` AND r.name ILIKE $${paramIndex}`;
      params.push(`%${roomName}%`);
      paramIndex++;
    }

    if (hostId) {
      whereClause += ` AND r.host_id = $${paramIndex}`;
      params.push(hostId);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (fromDate) {
      whereClause += ` AND m.started_at >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereClause += ` AND m.started_at <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    const meetings = await query<MeetingRow>(`
      SELECT m.id, m.room_id, r.name as room_name, r.title as room_title,
        r.host_id, u.name as host_name, m.started_at, m.ended_at,
        m.status, m.recording_url,
        (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) as participant_count
      FROM meetings m
      LEFT JOIN rooms r ON r.id = m.room_id
      LEFT JOIN users u ON u.id = r.host_id
      ${whereClause}
      ORDER BY m.started_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const totalResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM meetings m
      LEFT JOIN rooms r ON r.id = m.room_id
      ${whereClause}
    `, params);

    res.json({
       meetings: meetings.map((m) => ({
         id: m.id,
         roomId: m.room_id,
         roomName: m.room_name,
         roomTitle: m.room_title,
         hostId: m.host_id,
         hostName: m.host_name,
         participantCount: Number(m.participant_count),
         startedAt: m.started_at,
         endedAt: m.ended_at,
         duration: m.ended_at ? Math.round((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 60000) : null,
         status: m.status,
         recordingUrl: m.recording_url,
       })),
      total: Number(totalResult?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

router.get('/meetings/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const meeting = await queryOne<MeetingRow>(`
      SELECT m.id, m.room_id, m.started_at, m.ended_at, m.status, m.recording_url,
        r.name as room_name, r.title as room_title, r.host_id
      FROM meetings m
      LEFT JOIN rooms r ON r.id = m.room_id
      WHERE m.id = $1
    `, [id]);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const participants = await query<ParticipantRow>(`
      SELECT mp.user_id, mp.joined_at, mp.left_at, u.name, u.email
      FROM meeting_participants mp
      LEFT JOIN users u ON u.id = mp.user_id
      WHERE mp.meeting_id = $1
      ORDER BY mp.joined_at ASC
    `, [id]);

    res.json({
      meeting: {
        id: meeting.id,
        roomId: meeting.room_id,
        roomName: meeting.room_name,
        roomTitle: meeting.room_title,
        hostId: meeting.host_id,
        startedAt: meeting.started_at,
        endedAt: meeting.ended_at,
        status: meeting.status,
        recordingUrl: meeting.recording_url,
      },
       participants: participants.map((p) => ({
         userId: p.user_id,
         name: p.name,
         email: p.email,
         joinedAt: p.joined_at,
         leftAt: p.left_at,
       })),
    });
  } catch (error) {
    logger.error('[Admin] Error fetching meeting:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

router.get('/meetings/:id/chat', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 100;
    const before = req.query.before as string | undefined;

    let whereClause = 'WHERE meeting_id = $1';
    const params: (string | number)[] = [id, limit];
    let paramIndex = 2;

    if (before) {
      whereClause += ` AND created_at < $${paramIndex}`;
      params.push(before);
      paramIndex++;
    }

    const messages = await query<ChatMessageRow>(`
      SELECT c.id, c.content, c.created_at, c.message_type, c.user_id,
        u.name as user_name, u.email as user_email
      FROM chat_messages c
      LEFT JOIN users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $2
    `, params);

     res.json({
       messages: messages.map((m) => ({
         id: m.id,
         content: m.content,
         createdAt: m.created_at,
         messageType: m.message_type,
         userId: m.user_id,
         userName: m.user_name,
         userEmail: m.user_email,
       })),
       hasMore: messages.length === limit,
     });
  } catch (error) {
    logger.error('[Admin] Error fetching meeting chat:', error);
    res.status(500).json({ error: 'Failed to fetch meeting chat' });
  }
});

export default router;
