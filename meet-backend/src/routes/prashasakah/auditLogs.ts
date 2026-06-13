/**
 * Prashasakah Audit Logs Routes
 *
 * Audit log retrieval from admin_audit_logs table.
 */

import { Router, Response } from 'express';
import { requireAdmin } from '../../middleware/requireRole.js';
import type { AuthRequest } from '../../middleware/authenticate.js';
import { query } from '../../services/database.js';
import logger from '../../utils/logger.js';

const router = Router();

const VALID_ACTION_TYPES = [
  'auth_failed', 'user_ban', 'user_unban', 'user_delete', 'user_update',
  'meeting_end', 'room_delete', 'settings_update', 'role_change',
  'api_key_create', 'api_key_delete', 'api_key_regenerate',
] as const;

router.get('/audit-logs', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
    const actionType = (req.query.action as string | undefined) || (req.query.action_type as string | undefined);
    const adminId = (req.query.actorId as string | undefined) || (req.query.admin_id as string | undefined);

    let whereClause = '';
    const params: any[] = [];
    const conditions: string[] = [];

    if (actionType && (VALID_ACTION_TYPES as readonly string[]).includes(actionType)) {
      params.push(actionType);
      conditions.push(`aal.action_type = $${params.length}`);
    }

    if (adminId) {
      params.push(adminId);
      conditions.push(`aal.admin_id = $${params.length}`);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_audit_logs aal ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    const logs = await query<{
      id: string;
      admin_id: string;
      actor_email: string | null;
      action_type: string;
      target_type: 'user' | 'room' | 'meeting' | 'system';
      target_id: string | null;
      details: Record<string, unknown> | null;
      ip_address: string | null;
      created_at: string;
    }>(
      `SELECT aal.id, aal.admin_id, u.email as actor_email, aal.action_type, aal.target_type, aal.target_id, aal.details, aal.ip_address, aal.created_at
       FROM admin_audit_logs aal
       LEFT JOIN users u ON u.id = aal.admin_id
       ${whereClause}
       ORDER BY aal.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action_type,
        targetType: log.target_type,
        targetId: log.target_id,
        actorId: log.admin_id,
        actorEmail: log.actor_email || 'Unknown admin',
        details: log.details || {},
        ipAddress: log.ip_address,
        createdAt: log.created_at,
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
