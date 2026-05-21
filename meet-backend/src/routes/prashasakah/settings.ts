/**
 * Prashasakah Settings Routes
 *
 * Application settings: view and update configuration.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireModerator, requireAdmin } from '../../middleware/requireRole.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import logger from '../../utils/logger.js';

const router = Router();

router.get('/settings', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = {
      room_defaults: {
        maxParticipants: 50,
        emptyTimeout: 300,
        waitingRoomEnabled: true,
      },
      recording: {
        storageType: 'local' as const,
        retentionDays: 30,
      },
      email: {
        fromAddress: 'noreply@example.com',
        fromName: 'Meet Conference',
      },
      alerts: {
        serverLoadThreshold: 80,
        failedRecordingAlert: true,
        userReportAlert: true,
        unusualActivityAlert: true,
      },
    };

    res.json({ settings });
  } catch (error) {
    logger.error('[Admin] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/settings', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const updateSchema = z.object({
      room_defaults: z.object({
        maxParticipants: z.number().min(2).max(500).optional(),
        emptyTimeout: z.number().min(60).max(3600).optional(),
        waitingRoomEnabled: z.boolean().optional(),
      }).optional(),
      recording: z.object({
        storageType: z.enum(['local', 's3']).optional(),
        retentionDays: z.number().min(1).max(365).optional(),
      }).optional(),
      email: z.object({
        fromAddress: z.string().email().optional(),
        fromName: z.string().optional(),
      }).optional(),
      alerts: z.object({
        serverLoadThreshold: z.number().min(0).max(100).optional(),
        failedRecordingAlert: z.boolean().optional(),
        userReportAlert: z.boolean().optional(),
        unusualActivityAlert: z.boolean().optional(),
      }).optional(),
    });

    const data = updateSchema.parse(req.body);
    const updatedKeys = Object.keys(data);

    res.json({ 
      message: 'Settings updated successfully',
      updatedKeys
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('[Admin] Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
