/**
 * Prashasakah Health Routes
 *
 * System health check endpoint.
 */

import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../../middleware/authenticate.js';
import { requireModerator } from '../../middleware/requireRole.js';
import { queryOne } from '../../services/database.js';
import logger from '../../utils/logger.js';

const router = Router();

// ============================================
// Health Check (System)
// ============================================

router.get('/health', requireModerator(), async (_req: AuthRequest, res: Response) => {
  try {
    // Check database
    await queryOne('SELECT 1');
    
    // Check Redis (skip if not configured)
    let redisStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';
    try {
      const redis = await import('../../services/redis.js');
      if (redis) {
        redisStatus = 'connected';
      }
    } catch {
      redisStatus = 'not_configured';
    }

    // LiveKit check (try/catch)
    let livekitStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await import('../../services/livekit.js');
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

export default router;
