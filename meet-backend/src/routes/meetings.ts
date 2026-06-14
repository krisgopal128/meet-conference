import { Router, Response } from 'express';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';
import { AuthRequest, authenticate, optionalAuth } from '../middleware/authenticate.js';
import { requireUser } from '../middleware/requireUser.js';
import { query, queryOne } from '../services/database.js';
import { verifyMeetingAccess } from '../services/meetingService.js';
import { scheduleMeetingSchema, diagnosticsPayloadSchema } from '../schemas/meetings.js';
import { sanitizeChatMessage } from '../utils/validation.js';
import { getCached, invalidatePattern, TTL_MEDIUM, TTL_SHORT } from '../services/cache.js';
import logger from '../utils/logger.js';

export const meetingsRouter = Router();

// Interface for meeting with participant count
interface MeetingWithParticipants {
  id: string;
  room_id: string;
  room_name: string;
  room_title: string | null;
  started_at: Date;
  ended_at: Date | null;
  participant_count: number;
  max_participants: number;
  uniqueParticipants?: number;
}

// Interface for meeting query parameters
interface MeetingQueryParams {
  limit: number;
  offset: number;
}

// Helper to parse query params
function parsePaginationParams(query: Record<string, unknown>): MeetingQueryParams {
  return {
    limit: Math.min(Math.max(parseInt(String(query.limit), 10) || 20, 1), 100),
    offset: Math.max(parseInt(String(query.offset), 10) || 0, 0),
  };
}

// GET /meetings - Alias for meeting history
meetingsRouter.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { limit, offset } = parsePaginationParams(req.query);

    const result = await getCached<{ meetings: MeetingWithParticipants[] }>(
      `cache:meetings:user:${user.id}:${limit}:${offset}`,
      TTL_MEDIUM,
      async () => {
        const meetings = await query<MeetingWithParticipants>(
          `SELECT DISTINCT m.*, r.name as room_name, r.title as room_title
           FROM meetings m
           JOIN rooms r ON m.room_id = r.id
           LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = $1
           WHERE r.host_id = $1 OR mp.id IS NOT NULL
           ORDER BY m.started_at DESC
           LIMIT $2 OFFSET $3`,
          [user.id, limit, offset]
        );
        return { meetings };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('List meetings error:', error);
    res.status(500).json({ error: 'Failed to list meetings' });
  }
});

// GET /meetings/history - Get meeting history for current user
meetingsRouter.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { limit, offset } = parsePaginationParams(req.query);

    const result = await getCached<{ meetings: MeetingWithParticipants[] }>(
      `cache:meetings:history:${user.id}:${limit}:${offset}`,
      TTL_MEDIUM,
      async () => {
        const meetings = await query<MeetingWithParticipants>(
          `SELECT DISTINCT m.*, r.name as room_name, r.title as room_title,
                  COALESCE(mp_counts.unique_participants, 0)::integer as "uniqueParticipants"
           FROM meetings m
           JOIN rooms r ON m.room_id = r.id
           LEFT JOIN meeting_participants mp ON mp.meeting_id = m.id AND mp.user_id = $1
           LEFT JOIN (
             SELECT meeting_id, COUNT(*) as unique_participants
             FROM meeting_participants
             GROUP BY meeting_id
           ) mp_counts ON mp_counts.meeting_id = m.id
           WHERE r.host_id = $1 OR mp.id IS NOT NULL
           ORDER BY m.started_at DESC
           LIMIT $2 OFFSET $3`,
          [user.id, limit, offset]
        );
        return { meetings };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('Get meeting history error:', error);
    res.status(500).json({ error: 'Failed to get meeting history' });
  }
});

// POST /meetings/diagnostics - Upload client-side diagnostics for tuning
meetingsRouter.post('/diagnostics', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const payload = diagnosticsPayloadSchema.parse(req.body);
    const diagnosticsDir = join(process.cwd(), 'runtime', 'diagnostics');
    await mkdir(diagnosticsDir, { recursive: true });

    const safeRoomName = (payload.roomName || 'unknown-room').replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80);
    const safeIdentity = (payload.participantIdentity || req.user?.id || 'anonymous').replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80);
    const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}-${safeRoomName}-${safeIdentity}.json`;

    await writeFile(
      join(diagnosticsDir, filename),
      JSON.stringify({
        ...payload,
        uploadedAt: new Date().toISOString(),
        userId: req.user?.id || null,
        userEmail: req.user?.email || null,
      }, null, 2),
      'utf8',
    );

    res.status(202).json({
      message: 'Diagnostics accepted',
      file: filename,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Upload diagnostics error:', error);
    res.status(500).json({ error: 'Failed to upload diagnostics' });
  }
});

// GET /meetings/scheduled - Get scheduled meetings
meetingsRouter.get('/scheduled', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });

    const result = await getCached<{ meetings: unknown[] }>(
      `cache:meetings:scheduled:${user.id}`,
      TTL_SHORT,
      async () => {
        const meetings = await query(
          `SELECT sm.*, u.name as host_name, u.email as host_email
           FROM scheduled_meetings sm
           JOIN users u ON sm.host_id = u.id
           WHERE sm.host_id = $1 AND sm.status = 'scheduled' AND sm.scheduled_start > NOW()
           ORDER BY sm.scheduled_start ASC
           LIMIT 50`,
          [user.id]
        );
        return { meetings };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('Get scheduled meetings error:', error);
    res.status(500).json({ error: 'Failed to get scheduled meetings' });
  }
});

// POST /meetings/schedule - Schedule a new meeting
meetingsRouter.post('/schedule', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const data = scheduleMeetingSchema.parse(req.body);

    // Validate scheduled start is in the future
    if (new Date(data.scheduledStart) <= new Date()) {
      return res.status(400).json({ error: 'Scheduled start time must be in the future' });
    }

    // Generate room name from title
    const baseRoomName = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);

    const roomName = `${baseRoomName}-${Date.now().toString(36)}`;

    // Create scheduled meeting
    const [meeting] = await query(
      `INSERT INTO scheduled_meetings
        (room_name, title, description, host_id, scheduled_start, scheduled_end, participant_emails, timezone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        roomName,
        data.title,
        data.description || null,
        user.id,
        new Date(data.scheduledStart),
        data.scheduledEnd ? new Date(data.scheduledEnd) : null,
        data.participantEmails || [],
        data.timezone,
      ]
    );

    // Also create a room entry
    await query(
      `INSERT INTO rooms (name, title, description, host_id, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        roomName,
        data.title,
        data.description || null,
        user.id,
        new Date(data.scheduledStart),
        data.scheduledEnd ? new Date(data.scheduledEnd) : null,
      ]
    );

    // Invalidate meeting caches for this user and general caches
    await invalidatePattern(`cache:meetings:*`);
    await invalidatePattern('cache:rooms:*');
    await invalidatePattern('cache:stats:*');

    res.status(201).json({ meeting, roomName });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Schedule meeting error:', error);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

// GET /meetings/:id - Get meeting details
meetingsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;

    // Verify user has access to this meeting (host or participant)
    const meeting = await verifyMeetingAccess(id, user.id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or access denied' });
    }

    const result = await getCached<{ meeting: unknown; participants: unknown[] } | null>(
      `cache:meetings:detail:${id}`,
      TTL_SHORT,
      async () => {
        const meeting = await queryOne(
          `SELECT m.*, r.name as room_name, r.title as room_title, r.description as room_description
           FROM meetings m
           JOIN rooms r ON m.room_id = r.id
           WHERE m.id = $1`,
          [id]
        );

        if (!meeting) return null;

        const participants = await query(
          `SELECT mp.id, mp.identity, mp.role, mp.joined_at, mp.left_at, u.name as user_name
           FROM meeting_participants mp
           LEFT JOIN users u ON mp.user_id = u.id
           WHERE mp.meeting_id = $1
           ORDER BY mp.joined_at`,
          [id]
        );

        return { meeting, participants };
      },
    );

    if (!result) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    res.json(result);
  } catch (error) {
    logger.error('Get meeting error:', error);
    res.status(500).json({ error: 'Failed to get meeting' });
  }
});

// PATCH /meetings/scheduled/:id - Update a scheduled meeting
meetingsRouter.patch('/scheduled/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    
    // Validate update data (partial schema)
    const updateSchema = z.object({
      title: z.string().min(1).max(255).optional(),
      description: z.string().max(1000).optional(),
      scheduledStart: z.string().datetime().optional(),
      scheduledEnd: z.string().datetime().optional(),
      timezone: z.string().optional(),
    });
    
    const data = updateSchema.parse(req.body);
    
    // Check if there's anything to update
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }
    
    // Verify meeting exists and user is the host
    const meeting = await queryOne<{ id: string; host_id: string; room_name: string; status: string }>(
      'SELECT id, host_id, room_name, status FROM scheduled_meetings WHERE id = $1',
      [id]
    );
    
    if (!meeting) {
      return res.status(404).json({ error: 'Scheduled meeting not found' });
    }
    
    if (meeting.host_id !== user.id) {
      return res.status(403).json({ error: 'Only the host can update this meeting' });
    }
    
    if (meeting.status !== 'scheduled') {
      return res.status(400).json({ error: 'Can only update scheduled meetings' });
    }
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: (string | Date | null)[] = [];
    let paramIndex = 1;
    
    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description || null);
    }
    if (data.scheduledStart !== undefined) {
      updates.push(`scheduled_start = $${paramIndex++}`);
      values.push(new Date(data.scheduledStart));
    }
    if (data.scheduledEnd !== undefined) {
      updates.push(`scheduled_end = $${paramIndex++}`);
      values.push(data.scheduledEnd ? new Date(data.scheduledEnd) : null);
    }
    if (data.timezone !== undefined) {
      updates.push(`timezone = $${paramIndex++}`);
      values.push(data.timezone);
    }
    
    values.push(id);
    
    const [updatedMeeting] = await query(
      `UPDATE scheduled_meetings SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );
    
    // Also update the associated room if title or times changed
    if (data.title || data.scheduledStart || data.scheduledEnd) {
      const roomUpdates: string[] = [];
      const roomValues: (string | Date | null)[] = [];
      let roomParamIndex = 1;
      
      if (data.title !== undefined) {
        roomUpdates.push(`title = $${roomParamIndex++}`);
        roomValues.push(data.title);
      }
      if (data.scheduledStart !== undefined) {
        roomUpdates.push(`starts_at = $${roomParamIndex++}`);
        roomValues.push(new Date(data.scheduledStart));
      }
      if (data.scheduledEnd !== undefined) {
        roomUpdates.push(`ends_at = $${roomParamIndex++}`);
        roomValues.push(data.scheduledEnd ? new Date(data.scheduledEnd) : null);
      }
      
      if (roomUpdates.length > 0) {
        roomValues.push(meeting.room_name);
        await query(
          `UPDATE rooms SET ${roomUpdates.join(', ')} WHERE name = $${roomParamIndex}`,
          roomValues
        );
      }
    }
    
    res.json({ meeting: updatedMeeting });

    // Invalidate meeting caches
    invalidatePattern('cache:meetings:*').catch(() => {});
    invalidatePattern('cache:rooms:*').catch(() => {});
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Update scheduled meeting error:', error);
    res.status(500).json({ error: 'Failed to update scheduled meeting' });
  }
});

// DELETE /meetings/scheduled/:id - Cancel a scheduled meeting
meetingsRouter.delete('/scheduled/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;

    const meeting = await queryOne<{ id: string; host_id: string; room_name: string }>(
      'SELECT id, host_id, room_name FROM scheduled_meetings WHERE id = $1',
      [id]
    );

    if (!meeting) {
      return res.status(404).json({ error: 'Scheduled meeting not found' });
    }

    if (meeting.host_id !== user.id) {
      return res.status(403).json({ error: 'Only the host can cancel this meeting' });
    }

    // Update status
    await query(
      "UPDATE scheduled_meetings SET status = 'cancelled' WHERE id = $1",
      [id]
    );

    // Delete the room
    await query('DELETE FROM rooms WHERE name = $1', [meeting.room_name]);

    // Invalidate meeting caches
    invalidatePattern('cache:meetings:*').catch(() => {});
    invalidatePattern('cache:rooms:*').catch(() => {});

    res.json({ message: 'Meeting cancelled' });
  } catch (error) {
    logger.error('Cancel meeting error:', error);
    res.status(500).json({ error: 'Failed to cancel meeting' });
  }
});

// GET /meetings/:id/chat - Get chat messages for a meeting
meetingsRouter.get('/:id/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    const { limit = 100, before } = req.query;

    // Verify meeting exists and user has access
    const meeting = await verifyMeetingAccess(id, user.id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or access denied' });
    }

    // Get chat messages with properly typed params
    const parsedLimit = Math.min(parseInt(String(limit), 10) || 100, 500);
    const params: (string | number)[] = [id];
    
    let chatQuery = `
      SELECT cm.id, cm.content, cm.created_at, cm.message_type,
             u.id as user_id, u.name as user_name
      FROM chat_messages cm
      LEFT JOIN users u ON cm.user_id = u.id
      WHERE cm.meeting_id = $1
    `;

    if (before && typeof before === 'string') {
      chatQuery += ` AND cm.created_at < $${params.length + 1}`;
      params.push(before);
    }

    chatQuery += ` ORDER BY cm.created_at ASC LIMIT $${params.length + 1}`;
    params.push(parsedLimit);

    const messages = await query(chatQuery, params);

    res.json({ 
      messages,
      hasMore: messages.length === parsedLimit
    });
  } catch (error) {
    logger.error('Get meeting chat error:', error);
    res.status(500).json({ error: 'Failed to get chat messages' });
  }
});

// POST /meetings/:id/chat - Send a chat message
meetingsRouter.post('/:id/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { id } = req.params;
    const { content } = req.body;
    const validMessageTypes = ['text', 'system', 'file', 'emoji'];
    const messageType = validMessageTypes.includes(req.body.messageType) ? req.body.messageType : 'text';

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    if (content.length > 5000) {
      return res.status(400).json({ error: 'Message too long (max 5000 characters)' });
    }

    // Verify meeting exists and user has access
    const meeting = await verifyMeetingAccess(id, user.id);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found or access denied' });
    }

    // Insert message
    const messages = await query<{
      id: string;
      content: string;
      created_at: Date;
      message_type: string;
    }>(
      `INSERT INTO chat_messages (meeting_id, user_id, content, message_type)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, created_at, message_type`,
      [id, user.id, sanitizeChatMessage(content), messageType]
    );

    const message = messages[0];
    if (!message) {
      return res.status(500).json({ error: 'Failed to create message' });
    }

    res.status(201).json({ 
      message: {
        ...message,
        senderIdentity: user.id,
        senderName: user.name ?? user.email.split('@')[0],
      }
    });
  } catch (error) {
    logger.error('Send chat message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});
