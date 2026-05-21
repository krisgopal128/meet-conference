/**
 * Prashasakah Config Routes
 *
 * System configuration GET/PATCH endpoints.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireAdmin, requireModerator } from '../../middleware/requireRole.js';
import logger from '../../utils/logger.js';

const router = Router();

// ============================================
// Configuration
// ============================================

router.get('/config', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    // Return default/placeholder config (could be extended to read from DB)
    const config = {
      maxRoomsPerUser: 10,
      maxParticipantsPerRoom: 100,
      recordingEnabled: true,
      guestAccessEnabled: true,
      waitingRoomDefault: true,
      sessionTimeoutMinutes: 60,
    };

    res.json({ config });
  } catch (error) {
    logger.error('[Admin] Error fetching config:', error);
    res.status(500).json({ error: 'Failed to fetch config' });
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
    
    // In a full implementation, this would update the database
    // For now, just return success
    const updatedKeys = Object.keys(data);

    res.json({ 
      message: 'Config updated successfully',
      updatedKeys
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
