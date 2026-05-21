/**
 * Prashasakah Admin Routes
 *
 * Admin panel API endpoints for user management, meeting oversight,
 * system configuration, and audit logging.
 *
 * All routes require authentication and appropriate role permissions.
 */

import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { adminActionLimiter } from './rateLimiter.js';
import statsRoutes from './stats.js';
import healthRoutes from './health.js';
import configRoutes from './config.js';
import usersRoutes from './users.js';
import roomsRoutes from './rooms.js';
import meetingsRoutes from './meetings.js';
import alertsRoutes from './alerts.js';
import auditLogsRoutes from './auditLogs.js';
import settingsRoutes from './settings.js';
import apiKeysRoutes from './apiKeys.js';

export const prashasakahRouter = Router();

export { adminActionLimiter };

// All prashasakah routes require authentication
prashasakahRouter.use(authenticate);

// Mount sub-routers
prashasakahRouter.use('/', statsRoutes);
prashasakahRouter.use('/', healthRoutes);
prashasakahRouter.use('/', configRoutes);
prashasakahRouter.use('/', usersRoutes);
prashasakahRouter.use('/', roomsRoutes);
prashasakahRouter.use('/', meetingsRoutes);
prashasakahRouter.use('/', alertsRoutes);
prashasakahRouter.use('/', auditLogsRoutes);
prashasakahRouter.use('/', settingsRoutes);
prashasakahRouter.use('/', apiKeysRoutes);
