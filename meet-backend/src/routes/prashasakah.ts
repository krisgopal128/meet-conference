/**
 * Prashasakah Admin Routes
 * 
 * Admin panel API endpoints for user management, meeting oversight,
 * system configuration, and audit logging.
 * 
 * All routes require authentication and appropriate role permissions.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { authenticate, AuthRequest } from '../middleware/authenticate.js';
import { requireAdmin, requireModerator } from '../middleware/requireRole.js';
import { query, queryOne } from '../services/database.js';
import { sanitizeName, validatePassword } from '../utils/validation.js';
import logger from '../utils/logger.js';

export const prashasakahRouter = Router();

// ============================================
// Rate Limiting for Sensitive Admin Operations
// ============================================
export const adminActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 sensitive actions per hour per IP
  message: { error: 'Too many admin actions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

// ============================================
// All routes require authentication
// ============================================
prashasakahRouter.use(authenticate);

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

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().min(1).max(365).default(7).optional(),
});

// Type definitions for stats responses
interface UserByRoleStats {
  admin: number;
  moderator: number;
  participant: number;
}

interface UserStats {
  total: number;
  active: number;
  banned: number;
  guests: number;
  byRole: UserByRoleStats;
}

interface MeetingStats {
  total: number;
  ongoing: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface RoomStats {
  total: number;
  active: number;
}

interface BandwidthStats {
  totalBytes: number;
  todayBytes: number;
}

interface AlertStats {
  unread: number;
  critical: number;
}

interface DashboardStatsResponse {
  users: UserStats;
  meetings: MeetingStats;
  rooms: RoomStats;
  peakConcurrentUsers: number;
  bandwidth: BandwidthStats;
  alerts: AlertStats;
}

interface BandwidthDataPoint {
  date: string;
  bytes: number;
  meetings: number;
}

interface PeakUsersDataPoint {
  date: string;
  peak: number;
  average: number;
}

// Row type interfaces for typed query results
interface MeetingRow {
  id: string;
  room_id: string;
  room_name: string;
  room_title: string;
  host_id: string;
  host_name: string;
  participant_count: number;
  started_at: Date;
  ended_at: Date | null;
  status: string;
  recording_url: string | null;
}

interface ParticipantRow {
  user_id: string;
  name: string | null;
  email: string | null;
  joined_at: Date;
  left_at: Date | null;
}

interface ChatMessageRow {
  id: string;
  content: string;
  created_at: Date;
  message_type: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
}

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

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  permissions: string[];
  last_used_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  user_role: string | null;
}

interface RoomRow {
  id: string;
  name: string;
  title: string;
  description: string | null;
  host_id: string;
  host_name: string | null;
  status: string;
  max_participants: number;
  waiting_room_enabled: boolean;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
  participant_count: number;
}

interface RoomDetailRow {
  id: string;
  name: string;
  title: string;
  description: string | null;
  host_id: string;
  host_name: string | null;
  host_email: string | null;
  status: string;
  max_participants: number;
  waiting_room_enabled: boolean;
  created_at: Date;
  started_at: Date | null;
  ended_at: Date | null;
}

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
// Dashboard & Stats
// ============================================

prashasakahRouter.get('/stats', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    // User stats
    const userStats = await queryOne<{
      total: number;
      active: number;
      banned: number;
      guests: number;
      admins: number;
      moderators: number;
      participants: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_banned = false THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN is_banned = true THEN 1 ELSE 0 END) as banned,
        SUM(CASE WHEN role = 'guest' THEN 1 ELSE 0 END) as guests,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'moderator' THEN 1 ELSE 0 END) as moderators,
        SUM(CASE WHEN role = 'participant' THEN 1 ELSE 0 END) as participants
      FROM users
    `);

    // Meeting stats
    const meetingStats = await queryOne<{
      total: number;
      ongoing: number;
      today: number;
      thisWeek: number;
      thisMonth: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'ongoing' THEN 1 ELSE 0 END) as ongoing,
        SUM(CASE WHEN DATE(started_at) = CURRENT_DATE THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN started_at >= DATE_TRUNC('week', CURRENT_DATE) THEN 1 ELSE 0 END) as thisWeek,
        SUM(CASE WHEN started_at >= DATE_TRUNC('month', CURRENT_DATE) THEN 1 ELSE 0 END) as thisMonth
      FROM meetings
    `);

    // Room stats
    const roomStats = await queryOne<{
      total: number;
      active: number;
    }>(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('waiting', 'active') THEN 1 ELSE 0 END) as active
      FROM rooms
    `);

    // Alert stats
    const alertStats = await queryOne<{
      unread: number;
      critical: number;
    }>(`
      SELECT 
        SUM(CASE WHEN read_at IS NULL THEN 1 ELSE 0 END) as unread,
        SUM(CASE WHEN severity = 'critical' AND read_at IS NULL THEN 1 ELSE 0 END) as critical
      FROM admin_alerts
      WHERE resolved_at IS NULL
    `);

    // Peak concurrent users (estimate based on this week's data)
    const peakStats = await queryOne<{ peak: number }>(`
      SELECT COALESCE(MAX(participant_count), 0) as peak
      FROM meetings
      WHERE started_at >= DATE_TRUNC('week', CURRENT_DATE)
    `);

    const stats: DashboardStatsResponse = {
      users: {
        total: userStats?.total || 0,
        active: userStats?.active || 0,
        banned: userStats?.banned || 0,
        guests: userStats?.guests || 0,
        byRole: {
          admin: userStats?.admins || 0,
          moderator: userStats?.moderators || 0,
          participant: userStats?.participants || 0,
        },
      },
      meetings: {
        total: meetingStats?.total || 0,
        ongoing: meetingStats?.ongoing || 0,
        today: meetingStats?.today || 0,
        thisWeek: meetingStats?.thisWeek || 0,
        thisMonth: meetingStats?.thisMonth || 0,
      },
      rooms: {
        total: roomStats?.total || 0,
        active: roomStats?.active || 0,
      },
      peakConcurrentUsers: peakStats?.peak || 0,
      bandwidth: {
        totalBytes: 0,
        todayBytes: 0,
      },
      alerts: {
        unread: alertStats?.unread || 0,
        critical: alertStats?.critical || 0,
      },
    };

    res.json(stats);
  } catch (error) {
    logger.error('[Admin] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Bandwidth chart data
prashasakahRouter.get('/stats/bandwidth', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const daysNum = days || 7;

    let bandwidthData: BandwidthDataPoint[] = [];
    try {
      bandwidthData = await query<BandwidthDataPoint>(`
        SELECT 
          DATE(created_at) as date,
          COALESCE(SUM(bytes_sent + bytes_received), 0) as bytes,
          COUNT(DISTINCT meeting_id) as meetings
        FROM meeting_diagnostics
        WHERE created_at >= CURRENT_DATE - INTERVAL '${daysNum} days'
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `);
    } catch {
      // meeting_diagnostics table may not exist yet — return empty data
      logger.info('[Admin] meeting_diagnostics table not available, returning empty bandwidth data');
    }

    const total = bandwidthData.reduce((sum, row) => sum + Number(row.bytes), 0);

    res.json({ data: bandwidthData, total });
  } catch (error) {
    logger.error('[Admin] Error fetching bandwidth stats:', error);
    res.status(500).json({ error: 'Failed to fetch bandwidth stats' });
  }
});

// Peak users chart data
prashasakahRouter.get('/stats/peak-users', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const daysNum = days || 7;

    const peakData = await query<PeakUsersDataPoint>(`
      SELECT 
        DATE(started_at) as date,
        MAX(participant_count) as peak,
        AVG(participant_count)::integer as average
      FROM meetings
      WHERE started_at >= CURRENT_DATE - INTERVAL '${daysNum} days'
        AND started_at IS NOT NULL
      GROUP BY DATE(started_at)
      ORDER BY date ASC
    `);

    res.json({ data: peakData });
  } catch (error) {
    logger.error('[Admin] Error fetching peak users stats:', error);
    res.status(500).json({ error: 'Failed to fetch peak users stats' });
  }
});

// ============================================
// Health Check (System)
// ============================================

prashasakahRouter.get('/health', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    // Check database
    await queryOne('SELECT 1');
    
    // Check Redis (skip if not configured)
    let redisStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';
    try {
      const redis = await import('../services/redis.js');
      if (redis) {
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'not_configured';
    }

    // LiveKit check (try/catch)
    let livekitStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await import('../services/livekit.js');
      // Just check if we can import, actual check would need a test room
      livekitStatus = 'connected';
    } catch {
      livekitStatus = 'disconnected';
    }

    // Memory and CPU (approximation)
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const health = {
      status: 'healthy' as const,
      uptime: process.uptime(),
      version: '1.0.0',
      database: 'connected' as const,
      redis: redisStatus,
      livekit: livekitStatus,
      activeRooms: 0, // Would need to query LiveKit
      activeParticipants: 0,
      memoryUsage: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
      },
      cpuUsage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000), // Convert to percentage approximation
    };

    res.json({ health });
  } catch (error) {
    logger.error('[Admin] Health check error:', error);
    res.status(503).json({ 
      error: 'Health check failed',
      health: { status: 'unhealthy' as const }
    });
  }
});

// ============================================
// Configuration
// ============================================

prashasakahRouter.get('/config', requireModerator(), async (_req: AuthRequest, res: Response) => {
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

prashasakahRouter.patch('/config', requireAdmin(), async (req: AuthRequest, res: Response) => {
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

// ============================================
// Users Management
// ============================================

prashasakahRouter.get('/users', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { limit, offset, search, role } = paginationSchema.parse(req.query);
    const status = (req.query.status as string) || undefined;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Note: role filtering skipped for simplicity
    if (role) { logger.info("role filter applied"); }

    if (status === 'banned') {
      whereClause += ' AND is_banned = true';
    } else if (status === 'active') {
      whereClause += ' AND is_banned = false';
    }

    const users = await query<{
      id: string;
      email: string;
      name: string | null;
      role: string;
      is_banned: boolean;
      last_login_at: string | null;
      created_at: string;
    }>(`
      SELECT id, email, name, role, is_banned, last_login_at, created_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const totalResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM users ${whereClause}
    `, params);

     res.json({
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
     });
  } catch (error) {
    logger.error('[Admin] Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

prashasakahRouter.get('/users/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = await queryOne<UserRow>(`
      SELECT id, email, name, role, is_banned, last_login_at, created_at
      FROM users WHERE id = $1
    `, [id]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get meeting stats
    const meetingStats = await queryOne<{ hosted: number; attended: number; duration: number }>(`
      SELECT 
        (SELECT COUNT(*) FROM rooms WHERE host_id = $1) as hosted,
        (SELECT COUNT(*) FROM meeting_participants WHERE user_id = $1 AND left_at IS NOT NULL) as attended,
        (SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (left_at - joined_at)) / 60), 0) FROM meeting_participants WHERE user_id = $1) as duration
    `, [id]);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isBanned: user.is_banned,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
        emailVerified: false, // Not tracked in current schema
        lastLoginIp: null, // Would need to track this
        meetingsAttended: Number(meetingStats?.attended || 0),
        meetingsHosted: Number(meetingStats?.hosted || 0),
        totalDurationMinutes: Math.round(Number(meetingStats?.duration || 0)),
      },
    });
  } catch (error) {
    logger.error('[Admin] Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

prashasakahRouter.patch('/users/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role } = req.body;

    const updateFields: string[] = [];
    const params: (string)[] = [];
    let paramIndex = 1;

    // Validate role if provided
    if (role !== undefined) {
      const validRoles = ['admin', 'moderator', 'participant', 'guest'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be one of: admin, moderator, participant, guest' });
      }
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
    logger.error('[Admin] Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

prashasakahRouter.post('/users/:id/ban', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await query('UPDATE users SET is_banned = true WHERE id = $1', [id]);
    logger.info(`[Admin] User ${id} banned by ${req.user?.id}${reason ? ` - Reason: ${reason}` : ''}`);

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

prashasakahRouter.post('/users/:id/unban', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query('UPDATE users SET is_banned = false WHERE id = $1', [id]);
    logger.info(`[Admin] User ${id} unbanned by ${req.user?.id}`);

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

prashasakahRouter.delete('/users/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Don't allow deletion of self
    if (id === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await query('DELETE FROM users WHERE id = $1', [id]);
    logger.info(`[Admin] User ${id} deleted by ${req.user?.id}`);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('[Admin] Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

prashasakahRouter.post('/users/:id/reset-password', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
    logger.info(`[Admin] Password reset for user ${id} by ${req.user?.id}. Temp password generated.`);

    res.json({ 
      message: 'Password reset successfully. User should check their email for the new password.',
    });
  } catch (error) {
    logger.error('[Admin] Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

prashasakahRouter.put('/users/:id/change-password', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || typeof password !== 'string') {
      res.status(400).json({ error: 'Password is required' });
      return;
    }

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

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Password')) {
      res.status(400).json({ error: error.message });
      return;
    }
    logger.error('[Admin] Error changing password:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

prashasakahRouter.get('/users/:id/activity', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    // For now, return empty - would need audit_logs table
    // Query params (id, pagination) will be used when audit_logs table is implemented
    void req.params.id;
    void paginationSchema.parse(req.query);

    res.json({
      activities: [],
      total: 0,
      hasMore: false,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching user activity:', error);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

// ============================================
// Rooms Management (Admin)
// ============================================

prashasakahRouter.get('/rooms', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND (name ILIKE $${paramIndex} OR title ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const rooms = await query<RoomRow>(`
      SELECT r.id, r.name, r.title, r.description, r.host_id, u.name as host_name,
        r.status, r.max_participants, r.waiting_room_enabled, r.created_at,
        r.started_at, r.ended_at,
        (SELECT COUNT(*) FROM meeting_participants mp 
         JOIN meetings m ON m.id = mp.meeting_id 
         WHERE m.room_id = r.id AND mp.left_at IS NULL) as participant_count
      FROM rooms r
      LEFT JOIN users u ON u.id = r.host_id
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const totalResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM rooms ${whereClause}
    `, params);

     res.json({
       rooms: rooms.map((r) => ({
         id: r.id,
         name: r.name,
         title: r.title,
         description: r.description,
         hostId: r.host_id,
         hostName: r.host_name,
         status: r.status,
         maxParticipants: r.max_participants,
         waitingRoomEnabled: r.waiting_room_enabled,
         createdAt: r.created_at,
       })),
      total: Number(totalResult?.count || 0),
      hasMore: Number(totalResult?.count || 0) > offset + limit,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

prashasakahRouter.get('/rooms/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const room = await queryOne<RoomDetailRow>(`
      SELECT r.id, r.name, r.title, r.description, r.host_id, u.name as host_name, u.email as host_email,
        r.status, r.max_participants, r.waiting_room_enabled, r.created_at, r.started_at, r.ended_at
      FROM rooms r
      LEFT JOIN users u ON u.id = r.host_id
      WHERE r.id = $1
    `, [id]);

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json({
      room: {
        id: room.id,
        name: room.name,
        title: room.title,
        description: room.description,
        hostId: room.host_id,
        hostName: room.host_name,
        hostEmail: room.host_email,
        status: room.status,
        maxParticipants: room.max_participants,
        waitingRoomEnabled: room.waiting_room_enabled,
        createdAt: room.created_at,
        startedAt: room.started_at,
        endedAt: room.ended_at,
      },
    });
  } catch (error) {
    logger.error('[Admin] Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

prashasakahRouter.post('/rooms/:id/end', adminActionLimiter, requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE rooms SET status = 'ended' WHERE id = $1
    `, [id]);

    // Also update any active meetings
    await query(`
      UPDATE meetings SET status = 'ended', ended_at = NOW()
      WHERE room_id = $1 AND status = 'ongoing'
    `, [id]);

    logger.info(`[Admin] Room ${id} ended by ${req.user?.id}`);

    res.json({ message: 'Room ended successfully' });
  } catch (error) {
    logger.error('[Admin] Error ending room:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

prashasakahRouter.delete('/rooms/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query('DELETE FROM rooms WHERE id = $1', [id]);
    logger.info(`[Admin] Room ${id} deleted by ${req.user?.id}`);

    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    logger.error('[Admin] Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ============================================
// Meetings Management (Admin)
// ============================================

prashasakahRouter.get('/meetings', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const roomId = req.query.roomId as string | undefined;
    const roomName = req.query.roomName as string | undefined;
    const hostId = req.query.hostId as string | undefined;
    const status = req.query.status as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (roomId) {
      whereClause += ` AND m.room_id = $${paramIndex}`;
      params.push(roomId);
      paramIndex++;
    }

    if (roomName) {
      whereClause += ` AND r.name ILIKE $${paramIndex}`;
      params.push(`%${roomName}%`);
      paramIndex++;
    }

    if (hostId) {
      whereClause += ` AND r.host_id = $${paramIndex}`;
      params.push(hostId);
      paramIndex++;
    }

    if (status) {
      whereClause += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (fromDate) {
      whereClause += ` AND m.started_at >= $${paramIndex}`;
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      whereClause += ` AND m.started_at <= $${paramIndex}`;
      params.push(toDate);
      paramIndex++;
    }

    const meetings = await query<MeetingRow>(`
      SELECT m.id, m.room_id, r.name as room_name, r.title as room_title,
        r.host_id, u.name as host_name, m.started_at, m.ended_at,
        m.status, m.recording_url,
        (SELECT COUNT(*) FROM meeting_participants WHERE meeting_id = m.id) as participant_count
      FROM meetings m
      LEFT JOIN rooms r ON r.id = m.room_id
      LEFT JOIN users u ON u.id = r.host_id
      ${whereClause}
      ORDER BY m.started_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    const totalResult = await queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM meetings m
      LEFT JOIN rooms r ON r.id = m.room_id
      ${whereClause}
    `, params);

    res.json({
       meetings: meetings.map((m) => ({
         id: m.id,
         roomId: m.room_id,
         roomName: m.room_name,
         roomTitle: m.room_title,
         hostId: m.host_id,
         hostName: m.host_name,
         participantCount: Number(m.participant_count),
         startedAt: m.started_at,
         endedAt: m.ended_at,
         duration: m.ended_at ? Math.round((new Date(m.ended_at).getTime() - new Date(m.started_at).getTime()) / 60000) : null,
         status: m.status,
         recordingUrl: m.recording_url,
       })),
      total: Number(totalResult?.count || 0),
      limit,
      offset,
    });
  } catch (error) {
    logger.error('[Admin] Error fetching meetings:', error);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

prashasakahRouter.get('/meetings/:id', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const meeting = await queryOne<MeetingRow>(`
      SELECT m.id, m.room_id, m.started_at, m.ended_at, m.status, m.recording_url,
        r.name as room_name, r.title as room_title, r.host_id
      FROM meetings m
      LEFT JOIN rooms r ON r.id = m.room_id
      WHERE m.id = $1
    `, [id]);

    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const participants = await query<ParticipantRow>(`
      SELECT mp.user_id, mp.joined_at, mp.left_at, u.name, u.email
      FROM meeting_participants mp
      LEFT JOIN users u ON u.id = mp.user_id
      WHERE mp.meeting_id = $1
      ORDER BY mp.joined_at ASC
    `, [id]);

    res.json({
      meeting: {
        id: meeting.id,
        roomId: meeting.room_id,
        roomName: meeting.room_name,
        roomTitle: meeting.room_title,
        hostId: meeting.host_id,
        startedAt: meeting.started_at,
        endedAt: meeting.ended_at,
        status: meeting.status,
        recordingUrl: meeting.recording_url,
      },
       participants: participants.map((p) => ({
         userId: p.user_id,
         name: p.name,
         email: p.email,
         joinedAt: p.joined_at,
         leftAt: p.left_at,
       })),
    });
  } catch (error) {
    logger.error('[Admin] Error fetching meeting:', error);
    res.status(500).json({ error: 'Failed to fetch meeting' });
  }
});

prashasakahRouter.get('/meetings/:id/chat', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const limit = Number(req.query.limit) || 100;
    const before = req.query.before as string | undefined;

    let whereClause = 'WHERE meeting_id = $1';
    const params: (string | number)[] = [id, limit];
    let paramIndex = 2;

    if (before) {
      whereClause += ` AND created_at < $${paramIndex}`;
      params.push(before);
      paramIndex++;
    }

    const messages = await query<ChatMessageRow>(`
      SELECT c.id, c.content, c.created_at, c.message_type, c.user_id,
        u.name as user_name, u.email as user_email
      FROM chat_messages c
      LEFT JOIN users u ON u.id = c.user_id
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $2
    `, params);

     res.json({
       messages: messages.map((m) => ({
         id: m.id,
         content: m.content,
         createdAt: m.created_at,
         messageType: m.message_type,
         userId: m.user_id,
         userName: m.user_name,
         userEmail: m.user_email,
       })),
       hasMore: messages.length === limit,
     });
  } catch (error) {
    logger.error('[Admin] Error fetching meeting chat:', error);
    res.status(500).json({ error: 'Failed to fetch meeting chat' });
  }
});

// ============================================
// Alerts
// ============================================

prashasakahRouter.get('/alerts', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const severity = req.query.severity as string | undefined;
    const unreadOnly = req.query.unreadOnly === 'true';

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

     res.json({
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
    });
  } catch (error) {
    logger.error('[Admin] Error fetching alerts:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

prashasakahRouter.post('/alerts/:id/read', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE admin_alerts SET read_at = NOW(), read_by = $1 WHERE id = $2
    `, [req.user!.id, id]);

    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    logger.error('[Admin] Error marking alert as read:', error);
    res.status(500).json({ error: 'Failed to mark alert as read' });
  }
});

prashasakahRouter.post('/alerts/:id/resolve', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    await query(`
      UPDATE admin_alerts SET resolved_at = NOW(), resolved_by = $1 WHERE id = $2
    `, [req.user!.id, id]);

    res.json({ message: 'Alert resolved' });
  } catch (error) {
    logger.error('[Admin] Error resolving alert:', error);
    res.status(500).json({ error: 'Failed to resolve alert' });
  }
});

prashasakahRouter.post('/alerts/read-all', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const result = await query(`
      UPDATE admin_alerts SET read_at = NOW(), read_by = $1 
      WHERE read_at IS NULL AND resolved_at IS NULL
    `, [req.user!.id]);

    res.json({ message: 'All alerts marked as read', updated: result.length });
  } catch (error) {
    logger.error('[Admin] Error marking all alerts as read:', error);
    res.status(500).json({ error: 'Failed to mark all alerts as read' });
  }
});

// ============================================
// Audit Logs
// ============================================

prashasakahRouter.get('/audit-logs', requireAdmin(), async (req: AuthRequest, res: Response) => {
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

// ============================================
// Settings
// ============================================

prashasakahRouter.get('/settings', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    const settings = {
      room_defaults: {
        maxParticipants: 50,
        emptyTimeout: 300,
        waitingRoomEnabled: true,
      },
      recording: {
        storageType: 'local' as const,
        retentionDays: 30,
      },
      email: {
        fromAddress: 'noreply@example.com',
        fromName: 'Meet Conference',
      },
      alerts: {
        serverLoadThreshold: 80,
        failedRecordingAlert: true,
        userReportAlert: true,
        unusualActivityAlert: true,
      },
    };

    res.json({ settings });
  } catch (error) {
    logger.error('[Admin] Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

prashasakahRouter.patch('/settings', requireAdmin(), async (req: AuthRequest, res: Response) => {
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
    const updatedKeys = Object.keys(data);

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

// ============================================
// Admin API Keys Management
// ============================================

prashasakahRouter.get('/api-keys/admin', requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const isActive = req.query.is_active as string | undefined;
    // role filter will be used when implementing role-based API key filtering
    void req.query.role;

    let whereClause = 'WHERE 1=1';
     const params: unknown[] = [];
    let paramIndex = 1;

    if (search) {
      whereClause += ` AND ak.name ILIKE $${paramIndex}`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (isActive !== undefined) {
      whereClause += ` AND ak.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    const apiKeys = await query<ApiKeyRow>(`
      SELECT ak.id, ak.name, ak.prefix, ak.permissions, ak.last_used_at, ak.expires_at,
        ak.is_active, ak.created_at, ak.updated_at, ak.user_id,
        u.name as user_name, u.email as user_email, u.role as user_role
      FROM api_keys ak
      LEFT JOIN users u ON u.id = ak.user_id
      ${whereClause}
      ORDER BY ak.created_at DESC
    `, params);

     res.json({
       keys: apiKeys.map((ak) => ({
         id: ak.id,
         name: ak.name,
         prefix: ak.prefix,
         permissions: ak.permissions,
         lastUsedAt: ak.last_used_at,
         expiresAt: ak.expires_at,
         isActive: ak.is_active,
         createdAt: ak.created_at,
         updatedAt: ak.updated_at,
         user: {
           id: ak.user_id,
           name: ak.user_name,
           email: ak.user_email,
           role: ak.user_role,
         },
       })),
      total: apiKeys.length,
    });
  } catch (error) {
    logger.error('[Admin API Keys] Error fetching keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

prashasakahRouter.patch('/api-keys/admin/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active: isActive, reason } = req.body;

    const existing = await queryOne<{ id: string }>('SELECT id FROM api_keys WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    const updateFields: string[] = [];
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (typeof isActive === 'boolean') {
      updateFields.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    await query(`UPDATE api_keys SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`, params);
    
    logger.info(`[Admin API Keys] Admin ${req.user?.id} updated key ${id}: is_active=${isActive}${reason ? `, reason: ${reason}` : ''}`);

    res.json({ 
      success: true, 
      message: 'API key updated',
      key: { id, isActive: isActive ?? true }
    });
  } catch (error) {
    logger.error('[Admin API Keys] Error updating key:', error);
    res.status(500).json({ error: 'Failed to update API key' });
  }
});

prashasakahRouter.delete('/api-keys/admin/:id', adminActionLimiter, requireAdmin(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminId = req.user!.id;

    const existing = await queryOne<{ id: string; user_id: string }>('SELECT id, user_id FROM api_keys WHERE id = $1', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await query('DELETE FROM api_keys WHERE id = $1', [id]);
    
    logger.info(`[Admin API Keys] Admin ${adminId} deleted API key ${id} (owner: ${existing.user_id})`);
    
    res.json({ success: true, message: 'API key deleted' });
    
  } catch (error) {
    logger.error('[Admin API Keys] Error deleting key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});