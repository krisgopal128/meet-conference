import { Router, Response } from 'express';
import { z } from 'zod';
import { EncodedFileOutput, S3Upload, EgressStatus } from 'livekit-server-sdk';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { egressClient } from '../services/livekit.js';
import { query, queryOne } from '../services/database.js';
import { config } from '../config.js';

export const egressRouter = Router();

const startRecordingSchema = z.object({
  roomName: z.string().min(1),
});

const stopRecordingSchema = z.object({
  egressId: z.string().min(1),
});

// POST /egress/start - Start recording (host only)
egressRouter.post('/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = startRecordingSchema.parse(req.body);

    // Verify user is the host
    const [room] = await query<{ host_id: string }>(
      'SELECT host_id FROM rooms WHERE name = $1',
      [roomName]
    );

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    if (room.host_id !== req.user!.id) {
      return res.status(403).json({ error: 'Only the room host can start recording' });
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

    // Check if S3 is properly configured
    const hasValidS3Config = config.s3.bucket && config.s3.accessKey && config.s3.secretKey;

    // Start room composite egress
    const egress = await egressClient.startRoomCompositeEgress(roomName, {
      file: new EncodedFileOutput({
        filepath: filename,
        // Use S3 if properly configured
        output: hasValidS3Config
          ? {
              case: 's3',
              value: new S3Upload({
                bucket: config.s3.bucket!,
                region: config.s3.region,
                accessKey: config.s3.accessKey!,
                secret: config.s3.secretKey!,
              }),
            }
          : undefined,
      }),
    });

    // Store egress ID in room metadata
    await query(
      `UPDATE rooms SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{egressId}',
        $2::jsonb
      ) WHERE name = $1`,
      [roomName, JSON.stringify(egress.egressId)]
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
    console.error('Start recording error:', error);
    res.status(500).json({ error: 'Failed to start recording' });
  }
});

// POST /egress/stop - Stop recording (host only)
egressRouter.post('/stop', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { egressId } = stopRecordingSchema.parse(req.body);

    // Verify user is the host of the room being recorded
    const egress = (await egressClient.listEgress({ egressId })).find(e => e.egressId === egressId);
    if (egress?.roomName) {
      const room = await queryOne<{ host_id: string }>(
        'SELECT host_id FROM rooms WHERE name = $1',
        [egress.roomName]
      );
      if (room && room.host_id !== req.user!.id) {
        return res.status(403).json({ error: 'Only the room host can stop recording' });
      }
    }

    await egressClient.stopEgress(egressId);
    res.json({ status: 'recording_stopped', egressId });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('Stop recording error:', error);
    res.status(500).json({ error: 'Failed to stop recording' });
  }
});

// GET /egress/status/:roomName - Get recording status
egressRouter.get('/status/:roomName', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomName } = req.params;

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
    console.error('Get recording status error:', error);
    res.status(500).json({ error: 'Failed to get recording status' });
  }
});

// GET /egress/list - List recordings with pagination
egressRouter.get('/list', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);

    const allEgress = await egressClient.listEgress({});
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
    console.error('List recordings error:', error);
    res.status(500).json({ error: 'Failed to list recordings' });
  }
});
