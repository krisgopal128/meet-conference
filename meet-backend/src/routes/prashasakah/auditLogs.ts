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
  'password_reset', 'password_change', 'role_change',
  'meeting_end', 'room_delete', 'room_end',
  'settings_update', 'config_update',
  'api_key_create', 'api_key_delete', 'api_key_regenerate', 'api_key_update',
] as const;

router.get('/audit-logs', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset as string, 10) || 0, 0);
    const actionType = (req.query.action as string | undefined) || (req.query.action_type as string | undefined);
    const adminId = (req.query.actorId as string | undefined) || (req.query.admin_id as string | undefined);
    const targetType = req.query.targetType as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (actionType && (VALID_ACTION_TYPES as readonly string[]).includes(actionType)) {
      conditions.push(`aal.action_type = $${paramIndex++}`);
      params.push(actionType);
    }

    if (adminId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(adminId)) {
      conditions.push(`aal.admin_id = $${paramIndex++}`);
      params.push(adminId);
    }

    if (targetType && ['user', 'room', 'meeting', 'system', 'api_key'].includes(targetType)) {
      conditions.push(`aal.target_type = $${paramIndex++}`);
      params.push(targetType);
    }

    if (fromDate) {
      conditions.push(`aal.created_at >= $${paramIndex++}`);
      params.push(fromDate);
    }

    if (toDate) {
      conditions.push(`aal.created_at <= $${paramIndex++}`);
      params.push(toDate);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM admin_audit_logs aal ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    const logs = await query<{
      id: string;
      admin_id: string;
      actor_email: string | null;
      actor_name: string | null;
      action_type: string;
      target_type: string | null;
      target_id: string | null;
      details: Record<string, unknown> | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
    }>(
      `SELECT aal.id, aal.admin_id, u.email as actor_email, u.name as actor_name,
              aal.action_type, aal.target_type, aal.target_id, aal.details,
              aal.ip_address, aal.user_agent, aal.created_at
       FROM admin_audit_logs aal
       LEFT JOIN users u ON u.id = aal.admin_id
       ${whereClause}
       ORDER BY aal.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    // Summary stats for the current filter
    const statsResult = await query<{ action_type: string; count: string }>(
      `SELECT action_type, COUNT(*) as count FROM admin_audit_logs aal ${whereClause} GROUP BY action_type ORDER BY count DESC`,
      params
    );
    const stats = statsResult.map(s => ({ action: s.action_type, count: parseInt(s.count, 10) }));

    res.json({
      logs: logs.map((log) => ({
        id: log.id,
        action: log.action_type,
        targetType: log.target_type || 'system',
        targetId: log.target_id,
        actorId: log.admin_id,
        actorEmail: log.actor_email || 'Unknown',
        actorName: log.actor_name || undefined,
        details: log.details || {},
        ipAddress: log.ip_address,
        userAgent: log.user_agent,
        createdAt: log.created_at,
      })),
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
      stats,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;
