/**
 * Prashasakah Config Routes
 *
 * System configuration GET/PATCH endpoints.
 * Persists to system_settings table (key-value store).
 */

import { Router, Response } from 'express';
import { query } from '../../services/database.js';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/authenticate.js';
import { requireAdmin, requireModerator } from '../../middleware/requireRole.js';
import { getCached, invalidatePattern, TTL_LONG } from '../../services/cache.js';
import { auditAdminAction } from '../../utils/auditLog.js';
import { adminActionLimiter } from './rateLimiter.js';
import logger from '../../utils/logger.js';

const router = Router();

// Default values used when no DB entry exists
// Keys are prefixed with 'config:' to avoid collision with settings.ts section keys
const CONFIG_PREFIX = 'config:';
const CONFIG_KEYS = {
  maxRoomsPerUser: 'config:maxRoomsPerUser',
  maxParticipantsPerRoom: 'config:maxParticipantsPerRoom',
  recordingEnabled: 'config:recordingEnabled',
  guestAccessEnabled: 'config:guestAccessEnabled',
  waitingRoomDefault: 'config:waitingRoomDefault',
  sessionTimeoutMinutes: 'config:sessionTimeoutMinutes',
} as const;

const DEFAULTS: Record<string, unknown> = {
  [CONFIG_KEYS.maxRoomsPerUser]: 10,
  [CONFIG_KEYS.maxParticipantsPerRoom]: 100,
  [CONFIG_KEYS.recordingEnabled]: true,
  [CONFIG_KEYS.guestAccessEnabled]: true,
  [CONFIG_KEYS.waitingRoomDefault]: true,
  [CONFIG_KEYS.sessionTimeoutMinutes]: 60,
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

        // Start with defaults and override with DB values (only config: prefixed keys)
        const result: Record<string, unknown> = {};
        // Fill defaults with unprefixed keys for client
        for (const [dbKey, val] of Object.entries(DEFAULTS)) {
          const clientKey = dbKey.replace(CONFIG_PREFIX, '');
          result[clientKey] = val;
        }
        for (const row of rows) {
          if (!row.key.startsWith(CONFIG_PREFIX)) continue; // skip settings.ts keys
          try {
            const clientKey = row.key.replace(CONFIG_PREFIX, '');
            result[clientKey] = JSON.parse(row.value);
          } catch {
            const clientKey = row.key.replace(CONFIG_PREFIX, '');
            result[clientKey] = row.value;
          }
        }
        return result;
      },
    );

    res.json({ config });
  } catch (error) {
    logger.error('[Admin] Error fetching config:', error);
    // Fall back to defaults if DB query fails (strip prefix to match success-path format)
    const fallback: Record<string, unknown> = {};
    for (const [dbKey, val] of Object.entries(DEFAULTS)) {
      fallback[dbKey.replace(CONFIG_PREFIX, '')] = val;
    }
    res.json({ config: fallback });
  }
});

router.patch('/config', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
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

    // Upsert each key into system_settings (with config: prefix)
    for (const [key, value] of Object.entries(data)) {
      const dbKey = CONFIG_PREFIX + key;
      await query(
        `INSERT INTO system_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [dbKey, JSON.stringify(value)]
      );
    }

    // Invalidate config cache
    invalidatePattern('cache:config:*').catch(() => {});

    logger.info(`[Admin] Config updated by ${req.user?.id}: ${updatedKeys.join(', ')}`);
    void auditAdminAction(req, 'config_update', 'system', null, { updatedKeys });

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
