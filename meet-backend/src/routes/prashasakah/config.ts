/**
 * Prashasakah Config Routes
 *
 * System configuration GET/PATCH endpoints.
 * Persists to system_settings table (key-value store).
 */

import { Router, Response } from 'express';
import { query } from '../../services/database.js';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireAdmin, requireModerator } from '../../middleware/requireRole.js';
import { getCached, invalidatePattern, TTL_LONG } from '../../services/cache.js';
import logger from '../../utils/logger.js';

const router = Router();

// Default values used when no DB entry exists
const DEFAULTS: Record<string, unknown> = {
  maxRoomsPerUser: 10,
  maxParticipantsPerRoom: 100,
  recordingEnabled: true,
  guestAccessEnabled: true,
  waitingRoomDefault: true,
  sessionTimeoutMinutes: 60,
};

// ============================================
// Configuration
// ============================================

router.get('/config', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    const config = await getCached<Record<string, unknown>>(
      'cache:config:system',
      TTL_LONG,
      async () => {
        // Read all settings from DB
        const rows = await query<{ key: string; value: string }>(
          'SELECT key, value FROM system_settings'
        );

        // Start with defaults and override with DB values
        const result: Record<string, unknown> = { ...DEFAULTS };
        for (const row of rows) {
          try {
            result[row.key] = JSON.parse(row.value);
          } catch {
            result[row.key] = row.value;
          }
        }
        return result;
      },
    );

    res.json({ config });
  } catch (error) {
    logger.error('[Admin] Error fetching config:', error);
    // Fall back to defaults if DB query fails
    res.json({ config: { ...DEFAULTS } });
  }
});

router.patch('/config', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const updateSchema = z.object({
      maxRoomsPerUser: z.number().min(1).max(100).optional(),
      maxParticipantsPerRoom: z.number().min(2).max(500).optional(),
      recordingEnabled: z.boolean().optional(),
      guestAccessEnabled: z.boolean().optional(),
      waitingRoomDefault: z.boolean().optional(),
      sessionTimeoutMinutes: z.number().min(5).max(240).optional(),
    });

    const data = updateSchema.parse(req.body);
    const updatedKeys = Object.keys(data);

    if (updatedKeys.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Upsert each key into system_settings
    for (const [key, value] of Object.entries(data)) {
      await query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }

    // Invalidate config cache
    invalidatePattern('cache:config:*').catch(() => {});

    logger.info(`[Admin] Config updated by ${req.user?.id}: ${updatedKeys.join(', ')}`);

    res.json({
      message: 'Config updated successfully',
      updatedKeys,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('[Admin] Error updating config:', error);
    res.status(500).json({ error: 'Failed to update config' });
  }
});

export default router;
