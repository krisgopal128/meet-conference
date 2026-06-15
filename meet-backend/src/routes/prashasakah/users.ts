/**
 * Prashasakah Users Routes
 *
 * User management: list, detail, edit, ban, unban, delete,
 * reset-password, change-password, activity.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { AuthRequest, invalidateUserAuth, setUserBanned, clearUserBanned } from '../../middleware/authenticate.js';
import { requireAdmin, requireModerator } from '../../middleware/requireRole.js';
import { query, queryOne } from '../../services/database.js';
import { sanitizeName, validatePassword } from '../../utils/validation.js';
import { getCached, invalidateCache, invalidatePattern, buildListKey, TTL_MEDIUM } from '../../services/cache.js';
import logger from '../../utils/logger.js';
import { adminActionLimiter } from './rateLimiter.js';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  role: z.union([
    z.enum(['admin', 'moderator', 'participant']),
    z.array(z.enum(['admin', 'moderator', 'participant']))
  ]).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  role: z.enum(['admin', 'moderator', 'participant', 'guest']).optional(),
});

const changePasswordSchema = z.object({
  password: z.string().min(8).max(128),
});

// ============================================
// Row type interfaces
// ============================================

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_banned: boolean;
  last_login_at: string | null;
  created_at: string;
}

// ============================================
// Users Management
// ============================================

router.get('/users', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, search, role } = paginationSchema.parse(req.query);
    const status = (req.query.status as string) || undefined;

    const cacheKey = buildListKey('users', { limit, offset, search, role, status });

    const result = await getCached<{
      users: unknown[];
      total: number;
      hasMore: boolean;
    }>(
      cacheKey,
      TTL_MEDIUM,
      async () => {
        let whereClause = 'WHERE 1=1';
        const params: unknown[] = [];
        let paramIndex = 1;

        if (search) {
          whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
          params.push(`${search}%`);
          paramIndex++;
        }

        // Apply role filter (supports single role or array of roles)
        if (role) {
          if (Array.isArray(role)) {
            const placeholders = role.map(() => `$${paramIndex++}`).join(', ');
            whereClause += ` AND u.role IN (${placeholders})`;
            params.push(...role);
          } else {
            whereClause += ` AND u.role = $${paramIndex}`;
            params.push(role);
            paramIndex++;
          }
        }

        if (status === 'banned') {
          whereClause += ' AND is_banned = true';
        } else if (status === 'active') {
          whereClause += ' AND is_banned = false';
        }

        const users = await query<UserRow>(`
          SELECT id, email, name, role, is_banned, last_login_at, created_at
          FROM users
          ${whereClause}
          ORDER BY created_at DESC
          LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `, [...params, limit, offset]);

        const totalResult = await queryOne<{ count: number }>(`
          SELECT COUNT(*) as count FROM users ${whereClause}
        `, params);

        return {
          users: users.map((u) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            isBanned: u.is_banned,
            lastLoginAt: u.last_login_at,
            createdAt: u.created_at,
          })),
          total: Number(totalResult?.count || 0),
          hasMore: Number(totalResult?.count || 0) > offset + limit,
        };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.get('/users/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const result = await getCached<{
      user: unknown;
    } | null>(
      `cache:users:detail:${id}`,
      TTL_MEDIUM,
      async () => {
        const user = await queryOne<UserRow>(`
          SELECT id, email, name, role, is_banned, last_login_at, created_at
          FROM users WHERE id = $1
        `, [id]);

        if (!user) return null;

        // Get meeting stats
        const meetingStats = await queryOne<{ hosted: number; attended: number; duration: number }>(`
          SELECT
            (SELECT COUNT(*) FROM rooms WHERE host_id = $1) as hosted,
            (SELECT COUNT(*) FROM meeting_participants WHERE user_id = $1 AND left_at IS NOT NULL) as attended,
            (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (left_at - joined_at)) / 60), 0) FROM meeting_participants WHERE user_id = $1) as duration
        `, [id]);

        return {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            isBanned: user.is_banned,
            lastLoginAt: user.last_login_at,
            createdAt: user.created_at,
            emailVerified: false,
            lastLoginIp: null,
            meetingsAttended: Number(meetingStats?.attended || 0),
            meetingsHosted: Number(meetingStats?.hosted || 0),
            totalDurationMinutes: Math.round(Number(meetingStats?.duration || 0)),
          },
        };
      },
    );

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.patch('/users/:id', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role } = updateUserSchema.parse(req.body);

    const updateFields: string[] = [];
    const params: (string)[] = [];
    let paramIndex = 1;

    // Validate role if provided
    if (role !== undefined) {
      // Only admins can assign admin role
      if (role === 'admin' && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can assign admin role' });
      }
      // Moderators cannot modify admin users' roles
      if (req.user!.role === 'moderator') {
        const targetUser = await queryOne<{ role: string }>('SELECT role FROM users WHERE id = $1', [id]);
        if (targetUser?.role === 'admin') {
          return res.status(403).json({ error: 'Cannot modify admin user roles' });
        }
      }
    }

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      params.push(sanitizeName(name));
      paramIndex++;
    }

    if (role !== undefined) {
      updateFields.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await query(`
      UPDATE users SET ${updateFields.join(', ')} WHERE id = $${paramIndex}
    `, params);

    // Invalidate user caches
    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);

    const user = await queryOne<UserRow>('SELECT id, email, name, role, is_banned, last_login_at, created_at FROM users WHERE id = $1', [id]);

    res.json({
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        isBanned: user!.is_banned,
        lastLoginAt: user!.last_login_at,
        createdAt: user!.created_at,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('[Admin] Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.post('/users/:id/ban', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Prevent self-ban
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot ban your own account' });
    }

    // Moderators cannot ban admin users
    if (req.user!.role === 'moderator') {
      const targetUser = await queryOne<{ role: string; is_banned: boolean }>('SELECT role, is_banned FROM users WHERE id = $1', [id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.role === 'admin') {
        return res.status(403).json({ error: 'Moderators cannot ban admin users' });
      }
    }

    const banReason = typeof reason === 'string' && reason.trim() ? reason.trim().substring(0, 500) : null;
    await query('UPDATE users SET is_banned = true, ban_reason = $2, banned_at = NOW(), banned_by = $3 WHERE id = $1', [id, banReason, req.user!.id]);
    logger.info(`[Admin] User ${id} banned by ${req.user?.id}${banReason ? ` - Reason: ${banReason}` : ''}`);

    // Invalidate user caches
    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);
    setUserBanned(id);

    const user = await queryOne<UserRow>('SELECT id, email, name, role, is_banned, last_login_at, created_at FROM users WHERE id = $1', [id]);

    res.json({
      message: 'User banned successfully',
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        isBanned: true,
        lastLoginAt: user!.last_login_at,
        createdAt: user!.created_at,
      }
    });
  } catch (error) {
    logger.error('[Admin] Error banning user:', error);
    res.status(500).json({ error: 'Failed to ban user' });
  }
});

router.post('/users/:id/unban', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Moderators cannot unban admin users
    if (req.user!.role === 'moderator') {
      const targetUser = await queryOne<{ role: string; is_banned: boolean }>('SELECT role, is_banned FROM users WHERE id = $1', [id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (targetUser.role === 'admin') {
        return res.status(403).json({ error: 'Moderators cannot modify admin users' });
      }
    }

    await query('UPDATE users SET is_banned = false, ban_reason = NULL, banned_at = NULL, banned_by = NULL WHERE id = $1', [id]);
    logger.info(`[Admin] User ${id} unbanned by ${req.user?.id}`);

    // Invalidate user caches
    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);
    clearUserBanned(id);

    const user = await queryOne<UserRow>('SELECT id, email, name, role, is_banned, last_login_at, created_at FROM users WHERE id = $1', [id]);

    res.json({
      message: 'User unbanned successfully',
      user: {
        id: user!.id,
        email: user!.email,
        name: user!.name,
        role: user!.role,
        isBanned: false,
        lastLoginAt: user!.last_login_at,
        createdAt: user!.created_at,
      }
    });
  } catch (error) {
    logger.error('[Admin] Error unbanning user:', error);
    res.status(500).json({ error: 'Failed to unban user' });
  }
});

router.delete('/users/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deletion of self
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    logger.info(`[Admin] User ${id} deleted by ${req.user?.id}`);

    // Invalidate user caches
    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('[Admin] Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

router.post('/users/:id/reset-password', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Generate temporary password
    const tempPassword = crypto.randomBytes(16).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
    logger.info(`[Admin] Password reset for user ${id} by ${req.user?.id}. Temp password generated.`);

    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);

    res.json({
      message: 'Password reset successfully. The temporary password has been logged for the admin.',
    });
  } catch (error) {
    logger.error('[Admin] Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.put('/users/:id/change-password', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = changePasswordSchema.parse(req.body);

    validatePassword(password);

    // Prevent changing own password through admin endpoint (use profile settings instead)
    if (req.user?.id === id) {
      res.status(400).json({ error: 'Use profile settings to change your own password' });
      return;
    }

    // Check user exists
    const user = await queryOne<{ id: string }>('SELECT id FROM users WHERE id = $1', [id]);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, id]);
    logger.info(`[Admin] Password changed for user ${id} by admin ${req.user?.id}`);

    await invalidateCache(`cache:users:detail:${id}`);
    await invalidatePattern('cache:users:*');
    invalidateUserAuth(id);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation error', details: error.errors });
      return;
    }
    if (error instanceof Error && error.message.includes('Password')) {
      res.status(400).json({ error: error.message });
      return;
    }
    logger.error('[Admin] Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

router.get('/users/:id/activity', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { limit, offset } = paginationSchema.parse(req.query);

    const activities = await query<{
      id: string;
      activity_type: string;
      metadata: Record<string, unknown> | null;
      created_at: string;
    }>(
      `SELECT id, activity_type, metadata, created_at
       FROM user_activity
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [id, limit, offset]
    );

    const totalResult = await queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_activity WHERE user_id = $1',
      [id]
    );

    const total = Number(totalResult?.count || 0);

    res.json({
      activities: activities.map(a => ({
        id: a.id,
        type: a.activity_type,
        metadata: a.metadata,
        createdAt: a.created_at,
      })),
      total,
      hasMore: total > offset + limit,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

export default router;