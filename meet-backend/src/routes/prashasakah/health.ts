/**
 * Prashasakah Health Routes
 *
 * System health check endpoint — actually pings each service.
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireModerator } from '../../middleware/requireRole.js';
import { queryOne } from '../../services/database.js';
import { getRedisInfo } from '../../services/redis.js';
import { config } from '../../config.js';
import logger from '../../utils/logger.js';
import { RoomServiceClient } from 'livekit-server-sdk';

const router = Router();

// ============================================
// Health Check (System)
// ============================================

router.get('/health', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    // Check database with actual query
    let dbStatus: 'connected' | 'error' = 'connected';
    try {
      await queryOne('SELECT 1');
    } catch {
      dbStatus = 'error';
    }

    // Check Redis — use getRedisInfo which actually pings Redis
    let redisStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    let redisInfo: { usedMemory: string; totalKeys: number; hitRate: number } | null = null;
    try {
      const info = await getRedisInfo();
      redisStatus = info.connected ? 'connected' : 'disconnected';
      redisInfo = { usedMemory: info.usedMemory, totalKeys: info.totalKeys, hitRate: info.hitRate };
    } catch {
      redisStatus = 'error';
    }

    // Check LiveKit — actually list rooms (limited to 1)
    let livekitStatus: 'connected' | 'disconnected' | 'error' = 'disconnected';
    let activeRooms = 0;
    let activeParticipants = 0;
    try {
      const roomClient = new RoomServiceClient(config.livekit.url, config.livekit.apiKey, config.livekit.apiSecret);
      const rooms = await roomClient.listRooms([]);
      livekitStatus = 'connected';
      activeRooms = rooms.length;
      activeParticipants = rooms.reduce((sum, r) => sum + (r.numParticipants ?? 0), 0);
    } catch (err) {
      livekitStatus = 'error';
      logger.warn('[Health] LiveKit check failed:', err instanceof Error ? err.message : err);
    }

    // Memory and CPU
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const overallStatus = (dbStatus === 'connected' && redisStatus === 'connected' && livekitStatus === 'connected')
      ? 'healthy' as const
      : 'degraded' as const;

    res.json({
      health: {
        status: overallStatus,
        uptime: process.uptime(),
        database: dbStatus,
        redis: redisStatus,
        redisInfo,
        livekit: livekitStatus,
        activeRooms,
        activeParticipants,
        memoryUsage: {
          used: memUsage.heapUsed,
          total: memUsage.heapTotal,
          percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
        },
        cpuUsage: Math.round((cpuUsage.user + cpuUsage.system) / 1000000),
      }
    });
  } catch (error) {
    logger.error('[Admin] Health check error:', error);
    res.status(503).json({
      error: 'Health check failed',
      health: { status: 'unhealthy' as const }
    });
  }
});

export default router;
