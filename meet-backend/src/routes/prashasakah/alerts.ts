/**
 * Prashasakah Alerts Routes
 *
 * Admin alert management: list, read, resolve, read-all.
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireModerator } from '../../middleware/requireRole.js';
import { query, queryOne } from '../../services/database.js';
import { getCached, invalidatePattern, buildListKey, TTL_SHORT, TTL_MEDIUM } from '../../services/cache.js';
import logger from '../../utils/logger.js';

const router = Router();

// ============================================
// Row type interfaces
// ============================================

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  data: unknown;
  read_at: Date | null;
  read_by: string | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  created_at: Date;
}

// ============================================
// Alerts
// ============================================

router.get('/alerts', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const severity = req.query.severity as string | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

    const cacheKey = buildListKey('alerts', { limit, offset, severity, unreadOnly });

    const result = await getCached<{
      alerts: unknown[];
      total: number;
      hasMore: boolean;
    }>(
      cacheKey,
      TTL_SHORT,
      async () => {
        let whereClause = 'WHERE resolved_at IS NULL';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (severity) {
          whereClause += ` AND severity = $${paramIndex}`;
          params.push(severity);
          paramIndex++;
        }

        if (unreadOnly) {
          whereClause += ' AND read_at IS NULL';
        }

        const alerts = await query<AlertRow>(`
          SELECT * FROM admin_alerts
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        const totalResult = await queryOne<{ count: number }>(`
          SELECT COUNT(*) as count FROM admin_alerts ${whereClause}
        `, params);

        return {
          alerts: alerts.map((a) => ({
            id: a.id,
            type: a.type,
            severity: a.severity,
            title: a.title,
            message: a.message,
            data: a.data,
            readAt: a.read_at,
            readBy: a.read_by,
            resolvedAt: a.resolved_at,
            resolvedBy: a.resolved_by,
            createdAt: a.created_at,
          })),
          total: Number(totalResult?.count || 0),
          hasMore: Number(totalResult?.count || 0) > offset + limit,
        };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

router.post('/alerts/:id/read', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE admin_alerts SET read_at = NOW(), read_by = $1 WHERE id = $2
    `, [req.user!.id, id]);

    await invalidatePattern('cache:alerts:*');

    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    logger.error('[Admin] Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

router.post('/alerts/:id/resolve', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE admin_alerts SET resolved_at = NOW(), resolved_by = $1 WHERE id = $2
    `, [req.user!.id, id]);

    await invalidatePattern('cache:alerts:*');
    await invalidatePattern('cache:stats:*');

    res.json({ message: 'Alert resolved' });
  } catch (error) {
    logger.error('[Admin] Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

router.post('/alerts/read-all', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      UPDATE admin_alerts SET read_at = NOW(), read_by = $1
      WHERE read_at IS NULL AND resolved_at IS NULL
      RETURNING id
    `, [req.user!.id]);

    await invalidatePattern('cache:alerts:*');

    res.json({ message: 'All alerts marked as read', updated: result.length });
  } catch (error) {
    logger.error('[Admin] Error marking all alerts as read:', error);
    res.status(500).json({ error: 'Failed to mark all alerts as read' });
  }
});

export default router;
