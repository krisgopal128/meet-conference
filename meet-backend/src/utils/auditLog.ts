/**
 * Audit logging helper for admin (Prashasakah) actions.
 *
 * Writes a row to admin_audit_logs. Failures are logged but never thrown,
 * so an audit-write error cannot break the admin action itself.
 */
import type { Request } from 'express';
import { query } from '../services/database.js';
import logger from './logger.js';

export type AuditTargetType = 'user' | 'room' | 'meeting' | 'system' | 'api_key';

export interface AuditContext {
  /** Admin user id performing the action */
  adminId?: string;
  /** IP address of the requester (best-effort) */
  ip?: string | null;
  /** User-Agent of the requester (best-effort) */
  userAgent?: string | null;
}

function extractContext(req: Request): AuditContext {
  const userAgent = req.headers['user-agent'] || null;
  return {
    adminId: (req as { user?: { id?: string } }).user?.id,
    ip: req.ip || req.socket?.remoteAddress || null,
    userAgent: userAgent ? String(userAgent).substring(0, 255) : null,
  };
}

/**
 * Record an admin action in the audit log.
 *
 * @param req     Express request (used to resolve admin id / ip / user-agent)
 * @param action  Action type (e.g. 'user_ban', 'settings_update')
 * @param target  Target type (e.g. 'user', 'room', 'system')
 * @param targetId  Id of the affected entity, if any
 * @param details   Arbitrary JSON-serialisable details
 */
export async function auditAdminAction(
  req: Request,
  action: string,
  target: AuditTargetType,
  targetId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  const ctx = extractContext(req);
  try {
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ctx.adminId || null, action, target, targetId, JSON.stringify(details), ctx.ip, ctx.userAgent],
    );
  } catch (err) {
    logger.error('[Audit] Failed to record admin action:', err);
  }
}

/**
 * Record an admin action when you already have the context (no request object).
 */
export async function auditAdminActionCtx(
  ctx: AuditContext,
  action: string,
  target: AuditTargetType,
  targetId: string | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  try {
    await query(
      `INSERT INTO admin_audit_logs (admin_id, action_type, target_type, target_id, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [ctx.adminId || null, action, target, targetId, JSON.stringify(details), ctx.ip || null, ctx.userAgent || null],
    );
  } catch (err) {
    logger.error('[Audit] Failed to record admin action:', err);
  }
}

export { extractContext as extractAuditContext };
