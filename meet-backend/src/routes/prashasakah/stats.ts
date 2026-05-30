/**
 * Prashasakah Stats Routes
 *
 * Dashboard stats, bandwidth, and peak-users endpoints.
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../../middleware/authenticate.js';
import { requireModerator } from '../../middleware/requireRole.js';
import { query, queryOne } from '../../services/database.js';
import { getCached, TTL_MEDIUM, TTL_LONG } from '../../services/cache.js';
import logger from '../../utils/logger.js';

const router = Router();

// ============================================
// Validation Schemas
// ============================================

const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().min(1).max(365).default(7).optional(),
});

// ============================================
// Type definitions for stats responses
// ============================================

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

// ============================================
// Dashboard & Stats
// ============================================

router.get('/stats', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    const stats = await getCached<DashboardStatsResponse>(
      'cache:stats:dashboard',
      TTL_MEDIUM,
      async () => {
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

        return {
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
        } satisfies DashboardStatsResponse;
      },
    );

    res.json(stats);
  } catch (error) {
    logger.error('[Admin] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// Bandwidth chart data
router.get('/stats/bandwidth', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const daysNum = days || 7;

    const result = await getCached<{ data: BandwidthDataPoint[]; total: number }>(
      `cache:stats:bandwidth:${daysNum}`,
      TTL_LONG,
      async () => {
        let bandwidthData: BandwidthDataPoint[] = [];
        try {
          bandwidthData = await query<BandwidthDataPoint>(`
            SELECT
              DATE(created_at) as date,
              COALESCE(SUM(bytes_sent + bytes_received), 0) as bytes,
              COUNT(DISTINCT meeting_id) as meetings
            FROM meeting_diagnostics
            WHERE created_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `, [daysNum]);
        } catch {
          // meeting_diagnostics table may not exist yet — return empty data
          logger.info('[Admin] meeting_diagnostics table not available, returning empty bandwidth data');
        }

        const total = bandwidthData.reduce((sum, row) => sum + Number(row.bytes), 0);
        return { data: bandwidthData, total };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching bandwidth stats:', error);
    res.status(500).json({ error: 'Failed to fetch bandwidth stats' });
  }
});

// Peak users chart data
router.get('/stats/peak-users', requireModerator(), async (req: AuthRequest, res: Response) => {
  try {
    const { days } = dateRangeSchema.parse(req.query);
    const daysNum = days || 7;

    const result = await getCached<{ data: PeakUsersDataPoint[] }>(
      `cache:stats:peak-users:${daysNum}`,
      TTL_MEDIUM,
      async () => {
        const peakData = await query<PeakUsersDataPoint>(`
          SELECT
            DATE(started_at) as date,
            MAX(participant_count) as peak,
            AVG(participant_count)::integer as average
          FROM meetings
          WHERE started_at >= CURRENT_DATE - $1 * INTERVAL '1 day'
            AND started_at IS NOT NULL
          GROUP BY DATE(started_at)
          ORDER BY date ASC
        `, [daysNum]);

        return { data: peakData };
      },
    );

    res.json(result);
  } catch (error) {
    logger.error('[Admin] Error fetching peak users stats:', error);
    res.status(500).json({ error: 'Failed to fetch peak users stats' });
  }
});

export default router;
