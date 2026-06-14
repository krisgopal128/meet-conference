import { Router, Response } from 'express';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { requireUser } from '../middleware/requireUser.js';
import { query, queryOne } from '../services/database.js';
import { sanitizeChatMessage } from '../utils/validation.js';
import logger from '../utils/logger.js';
import * as roomService from '../services/roomService.js';

export const chatRouter = Router();

async function canAccessRoomChat(roomName: string, userId: string) {
  const room = await roomService.getRoomByName(roomName);

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

// GET /rooms/:name/chat - Get room chat history across all sessions of the room
chatRouter.get('/:name/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
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
    logger.error('Get room chat history error:', error);
    res.status(500).json({ error: 'Failed to get room chat history' });
  }
});

// POST /rooms/:name/chat - Persist a chat message for the latest room session
chatRouter.post('/:name/chat', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = requireUser(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const { name } = req.params;
    const { content } = req.body;
    const validMessageTypes = ['text', 'system', 'file', 'emoji'];
    const messageType = validMessageTypes.includes(req.body.messageType) ? req.body.messageType : 'text';

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

    if (room.settings?.participantsCanChat === false && room.host_id !== user.id) {
      return res.status(403).json({ error: 'Chat is disabled for participants in this room' });
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
        id: message.id,
        content: message.content,
        createdAt: message.created_at,
        messageType: message.message_type,
        senderIdentity: user.id,
        senderName: user.name ?? user.email.split('@')[0],
      },
    });
  } catch (error) {
    logger.error('Persist room chat message error:', error);
    res.status(500).json({ error: 'Failed to persist room chat message' });
  }
});
