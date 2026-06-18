import { Router, Response } from 'express';
import { z } from 'zod';
import { EncodedFileOutput, S3Upload, EgressStatus } from 'livekit-server-sdk';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { egressClient } from '../services/livekit.js';
import { query, queryOne } from '../services/database.js';
import { roomService } from '../services/roomService.js';
import { cacheIncrWithExpire, cacheDel } from '../services/redis.js';
import { config } from '../config.js';
import logger from '../utils/logger.js';

export const egressRouter = Router();

const startRecordingSchema = z.object({
  roomName: z.string().min(1),
});

const stopRecordingSchema = z.object({
  egressId: z.string().min(1),
});

// POST /egress/start - Start recording (host only)
egressRouter.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  let lockKey = '';
  try {
    const { roomName } = startRecordingSchema.parse(req.body);

    // Verify user is the host
    const hostId = await roomService.getRoomHostId(roomName);

    if (!hostId) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (hostId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the room host can start recording' });
    }

    // Acquire per-room lock to prevent concurrent start requests (double-click, retry)
    lockKey = `egress_lock:${roomName}`;
    const lockCount = await cacheIncrWithExpire(lockKey, 30);
    if (lockCount > 1) {
      await cacheDel(lockKey).catch(() => {});
      return res.status(409).json({ error: 'Recording start already in progress' });
    }

    // Check if recording is already in progress
    const activeEgress = await egressClient.listEgress({
      roomName,
      active: true,
    });

    if (activeEgress.length > 0) {
      return res.status(409).json({
        error: 'Recording already in progress',
        egressId: activeEgress[0].egressId,
      });
    }

    // Determine output location
    const filename = `recordings/${roomName}-${Date.now()}.mp4`;

    // Check if S3 is properly configured — recording requires S3 to avoid filling local disk
    const hasValidS3Config = config.s3.bucket && config.s3.accessKey && config.s3.secretKey;
    if (!hasValidS3Config) {
      return res.status(503).json({ error: 'Recording is unavailable — S3 storage is not configured' });
    }

    // Start room composite egress
    const egress = await egressClient.startRoomCompositeEgress(roomName, {
      file: new EncodedFileOutput({
        filepath: filename,
        output: {
          case: 's3',
          value: new S3Upload({
            bucket: config.s3.bucket!,
            region: config.s3.region,
            accessKey: config.s3.accessKey!,
            secret: config.s3.secretKey!,
          }),
        },
      }),
    });

    // Store egress ID in room metadata
    await query(
      `UPDATE rooms SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{egressId}',
        to_jsonb($2::text)
      ) WHERE name = $1`,
      [roomName, egress.egressId]
    );

    res.json({
      egressId: egress.egressId,
      status: 'recording_started',
      roomName,
      filename,
    });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Start recording error:', error);
      res.status(500).json({ error: 'Failed to start recording' });
    } finally {
      if (lockKey) cacheDel(lockKey).catch(() => {});
    }
});

// POST /egress/stop - Stop recording (host only)
egressRouter.post('/stop', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { egressId } = stopRecordingSchema.parse(req.body);

    // Verify user is the host of the room being recorded
    const egressList = await egressClient.listEgress({ egressId });
    const egress = egressList.find(e => e.egressId === egressId);
    if (!egress) {
      return res.status(404).json({ error: 'Recording not found' });
    }
    if (egress.roomName) {
      const room = await queryOne<{ host_id: string }>(
        'SELECT host_id FROM rooms WHERE name = $1',
        [egress.roomName]
      );
      if (!room || room.host_id !== req.user!.id) {
        return res.status(403).json({ error: 'Only the room host can stop recording' });
      }
    } else {
      // No roomName means we can't verify ownership — deny
      return res.status(403).json({ error: 'Cannot verify recording ownership' });
    }

    await egressClient.stopEgress(egressId);
    res.json({ status: 'recording_stopped', egressId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Stop recording error:', error);
    res.status(500).json({ error: 'Failed to stop recording' });
  }
});

// GET /egress/status/:roomName - Get recording status (host/participants only)
egressRouter.get('/status/:roomName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;

    // Verify user is host or participant of this room
    const hostId = await roomService.getRoomHostId(roomName);
    if (!hostId) {
      return res.status(404).json({ error: 'Room not found' });
    }
    const isHost = hostId === req.user!.id;
    if (!isHost) {
      const participant = await queryOne(
        'SELECT id FROM meeting_participants mp JOIN meetings m ON mp.meeting_id = m.id JOIN rooms r ON m.room_id = r.id WHERE r.name = $1 AND mp.user_id = $2 LIMIT 1',
        [roomName, req.user!.id]
      );
      if (!participant) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Single API call - filter client-side for active
    const allEgress = await egressClient.listEgress({
      roomName,
    });

    const activeEgress = allEgress.filter(e => 
      e.status === EgressStatus.EGRESS_ACTIVE || e.status === EgressStatus.EGRESS_STARTING
    );

    res.json({
      isRecording: activeEgress.length > 0,
      activeRecordings: activeEgress,
      allRecordings: allEgress.slice(0, 10), // Last 10 recordings
    });
  } catch (error) {
    logger.error('Get recording status error:', error);
    res.status(500).json({ error: 'Failed to get recording status' });
  }
});

// GET /egress/list - List recordings for user's rooms only
egressRouter.get('/list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    // Get room names where user is host
    const userRooms = await query<{ name: string }>(
      'SELECT name FROM rooms WHERE host_id = $1 LIMIT 50',
      [req.user!.id]
    );

    const egressPromises = userRooms.map(r =>
      egressClient.listEgress({ roomName: r.name }).catch(() => [] as Array<{ egressId: string; roomName?: string; status?: unknown; [k: string]: unknown }>)
    );
    const allEgress = (await Promise.all(egressPromises)).flat();
    const total = allEgress.length;
    const recordings = allEgress.slice(offset, offset + limit);
    
    res.json({
      recordings,
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error('List recordings error:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});
