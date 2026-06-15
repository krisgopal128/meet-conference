/**
 * Prashasakah Settings Routes
 *
 * Application settings: view and update configuration.
 * Persists to system_settings table in the database.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { requireModerator, requireAdmin } from '../../middleware/requireRole.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import { query, queryOne } from '../../services/database.js';
import { adminActionLimiter } from './rateLimiter.js';
import logger from '../../utils/logger.js';

const router = Router();

// Default values (used when DB has no row)
const DEFAULTS: Record<string, Record<string, unknown>> = {
  room_defaults: { maxParticipants: 50, emptyTimeout: 300, waitingRoomEnabled: true },
  recording: { storageType: 'local', retentionDays: 30 },
  email: { fromAddress: 'noreply@example.com', fromName: 'Meet Conference' },
  alerts: { serverLoadThreshold: 80, failedRecordingAlert: true, userReportAlert: true, unusualActivityAlert: true },
};

router.get('/settings', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    // Load all settings from DB
    const rows = await query<{ key: string; value: Record<string, unknown> }>(
      'SELECT key, value FROM system_settings'
    );

    // Merge DB values over defaults
    const settings: Record<string, Record<string, unknown>> = { ...DEFAULTS };
    for (const row of rows) {
      settings[row.key] = { ...(DEFAULTS[row.key] || {}), ...row.value };
    }

    res.json({ settings });
  } catch (error) {
    logger.error('[Admin] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/settings', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
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
    const updatedKeys: string[] = [];

    // Upsert each top-level key
    for (const [key, value] of Object.entries(data)) {
      // Merge with existing DB value or default
      const existing = await queryOne<{ value: Record<string, unknown> }>(
        'SELECT value FROM system_settings WHERE key = $1',
        [key]
      );
      const current = existing ? existing.value : (DEFAULTS[key] || {});
      const merged = { ...current, ...value };

      await query(
        `INSERT INTO system_settings (key, value, updated_at, updated_by)
         VALUES ($1, $2, NOW(), $3)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3`,
        [key, JSON.stringify(merged), req.user!.id]
      );
      updatedKeys.push(key);
    }

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