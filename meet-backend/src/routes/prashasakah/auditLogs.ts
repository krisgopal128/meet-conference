/**
 * Prashasakah Audit Logs Routes
 *
 * Audit log retrieval for admin oversight.
 */

import { Router, Response } from 'express';
import { requireAdmin } from '../../middleware/requireRole.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import logger from '../../utils/logger.js';

const router = Router();

router.get('/audit-logs', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    // Query params will be used when audit_logs table is implemented
    void req.query;

    // For now, return empty - would need dedicated audit_logs table
    res.json({
      logs: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
