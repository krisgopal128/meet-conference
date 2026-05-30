/**
 * External API Routes for Third-Party Integrations (Tuition Notebook)
 *
 * These routes are for Tuition Notebook and other external apps.
 * All routes require API key authentication.
 */

import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { AccessToken } from 'livekit-server-sdk';
import { sanitizeRoomName } from '../utils/validation.js';
import { config } from '../config.js';
import rateLimit from 'express-rate-limit';
import { query, queryOne } from '../services/database.js';
import logger from '../utils/logger.js';
import type { AuthRequest } from '../middleware/authenticate.js';

const router = Router();

 // Request augmented with API key info after verification
interface ExternalApiRequest extends AuthRequest {
   apiKey?: {
     id: string;
     userId: string;
     permissions: Record<string, unknown>;
   };
 }

// ==================== Validation Schemas ====================

const createExternalRoomSchema = z.object({
  name: z.string().min(1).max(255),
  title: z.string().max(255).optional(),
  waitingRoomEnabled: z.boolean().optional().default(true),
  metadata: z.record(z.unknown()).optional().default({}),
});

const externalTokenSchema = z.object({
  room: z.string().min(1).max(255),
  identity: z.string().min(1).max(255),
  name: z.string().max(255).optional(),
  role: z.enum(['moderator', 'attendee', 'observer', 'presenter', 'teacher', 'student']).optional().default('attendee'),
  metadata: z.record(z.unknown()).optional().default({}),
});

// ==================== Response Types ====================

// API Key verification middleware

// Configuration (centralized from config module)
const LIVEKIT_URL = config.livekit.url;
const LIVEKIT_API_KEY = config.livekit.apiKey;
const LIVEKIT_API_SECRET = config.livekit.apiSecret;
const FRONTEND_URL = config.frontendUrl;

// Validate required LiveKit configuration
if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  logger.warn('[External API] LIVEKIT_API_KEY or LIVEKIT_API_SECRET not set. External API will not function correctly.');
}

// ==================== Rate Limiting ====================

/**
 * Strict rate limiter for external API - 100 requests per hour per API key
 * This is separate from the general API limiter and applies specifically to external integrations
 */
const externalApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // 100 requests per hour per API key
  message: { error: 'External API rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false as any,
  keyGenerator: (req: Request): string => {
    // Use API key as the rate limit key (extract from Authorization header)
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.substring(7);
      // Hash the key to avoid storing raw keys in rate limit store
      return crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16);
    }
    // Fallback to IP if no API key (will be rejected by auth anyway)
    return req.ip || 'unknown';
  },
});

// ==================== Middleware ====================

/**
 * Verify API key for external requests
 * Checks both environment variable and database
 */
async function verifyAPIKey(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Include Authorization: Bearer <api-key> header.' });
  }
  
  const apiKey = authHeader.substring(7);
  
  // Check database for API keys
  try {
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    
     const dbKey = await queryOne<{
       id: string;
       user_id: string;
       is_active: boolean;
       permissions: Record<string, unknown>;
       expires_at: Date | null;
     }>(
      `SELECT id, user_id, is_active, permissions, expires_at 
       FROM api_keys 
       WHERE key_hash = $1`,
      [keyHash]
    );
    
    if (!dbKey) {
      return res.status(403).json({ error: 'Invalid or expired API key' });
    }
    
    if (!dbKey.is_active) {
      return res.status(403).json({ error: 'Invalid or expired API key' });
    }
    
    if (dbKey.expires_at && new Date(dbKey.expires_at) < new Date()) {
      return res.status(403).json({ error: 'Invalid or expired API key' });
    }
    
    // Update last_used_at
    await query(
      'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
      [dbKey.id]
    );
    
     // Attach key info to request for later use
     (req as ExternalApiRequest).apiKey = {
       id: dbKey.id,
       userId: dbKey.user_id,
       permissions: dbKey.permissions,
     };
    
    next();
  } catch (error) {
    logger.error('[External API] Error verifying API key:', error);
    return res.status(500).json({ error: 'Failed to verify API key' });
  }
}

function hasApiKeyPermission(req: Request, scope: 'rooms' | 'meetings' | 'token', action: string): boolean {
  const permissions = (req as ExternalApiRequest).apiKey?.permissions || {};
  const scopePermissions = permissions[scope] as Record<string, unknown> | undefined;
  return scopePermissions?.[action] === true;
}

function requireApiKeyPermission(
  req: Request,
  res: Response,
  scope: 'rooms' | 'meetings' | 'token',
  action: string,
): boolean {
  if (hasApiKeyPermission(req, scope, action)) {
    return true;
  }

  res.status(403).json({
    error: 'API key does not have permission for this action',
    requires_permission: `${scope}.${action}`,
  });
  return false;
}

// ==================== Health Check (NO AUTH - must be before middleware) ====================

/**
 * Health check endpoint (no auth required)
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'meet-conference-external-api',
    livekit: LIVEKIT_URL,
    timestamp: new Date().toISOString(),
    version: 'unknown', // package.json version resolved at build time
  });
});

// Apply rate limiting and API key verification to all routes below
router.use(externalApiLimiter);
router.use(verifyAPIKey);

// ==================== Room Routes ====================

/**
 * Create a new room
 * POST /external/rooms
 */
router.post('/rooms', async (req: Request, res: Response) => {
  try {
    if (!requireApiKeyPermission(req, res, 'rooms', 'create')) return;

    let name: string, title: string | undefined, waitingRoomEnabled: boolean, metadata: Record<string, unknown>;
    try {
      const parsed = createExternalRoomSchema.parse(req.body);
      name = parsed.name;
      title = parsed.title;
      waitingRoomEnabled = parsed.waitingRoomEnabled;
      metadata = parsed.metadata;
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid request body', details: (validationError as Error).message });
    }
    
     // Get user ID from API key
     const userId = (req as ExternalApiRequest).apiKey?.userId;
    
     // Sanitize room name using strict validation
     let sanitized: string;
     try {
       sanitized = sanitizeRoomName(name);
     } catch (err) {
       return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid room name' });
     }
    
    // Check if room already exists
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM rooms WHERE name = $1',
      [sanitized]
    );
    
    if (existing) {
      return res.json({ 
        name: sanitized, 
        message: 'Room already exists',
        url: `${FRONTEND_URL}/join/${sanitized}`
      });
    }
    
    // Create room in database with host_id from API key owner
    await query(
      `INSERT INTO rooms (name, title, host_id, status, waiting_room_enabled, settings) 
       VALUES ($1, $2, $3, 'waiting', $4, $5) 
       RETURNING id`,
      [sanitized, title || sanitized, userId, waitingRoomEnabled, JSON.stringify(metadata)]
    );
    
    logger.info(`[External API] Created room: ${sanitized}`);
    
    res.json({
      name: sanitized,
      title: title || sanitized,
      url: `${FRONTEND_URL}/join/${sanitized}`
    });
    
  } catch (error) {
    logger.error('[External API] Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

/**
 * Get room info
 * GET /external/rooms/:name
 */
router.get('/rooms/:name', async (req: Request, res: Response) => {
  try {
    if (!requireApiKeyPermission(req, res, 'rooms', 'read')) return;

    const { name } = req.params;
    
    const room = await queryOne<{ 
      id: string;
      name: string;
      title: string;
      status: string;
      waiting_room_enabled: boolean;
    }>(
      'SELECT id, name, title, status, waiting_room_enabled FROM rooms WHERE name = $1',
      [name]
    );
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    res.json(room);
    
  } catch (error) {
    logger.error('[External API] Error getting room:', error);
    res.status(500).json({ error: 'Failed to get room' });
  }
});

/**
 * Get access token for joining
 * POST /external/token
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    let room: string, identity: string, name: string | undefined, role: string, metadata: Record<string, unknown>;
    try {
      const parsed = externalTokenSchema.parse(req.body);
      room = parsed.room;
      identity = parsed.identity;
      name = parsed.name;
      role = parsed.role;
      metadata = parsed.metadata;
    } catch (validationError) {
      return res.status(400).json({ error: 'Invalid request body', details: (validationError as Error).message });
    }
    
    // Verify room exists
    const roomData = await queryOne<{
      id: string
    }>(
      'SELECT id FROM rooms WHERE name = $1',
      [room]
    );
    
    if (!roomData) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
     // Check API key permissions
     const apiKeyInfo = (req as ExternalApiRequest).apiKey;
     const permissions = apiKeyInfo?.permissions || {};
    const tokenPerms = (permissions.token || {}) as Record<string, unknown>;
    const canGenerateToken = tokenPerms.generate === true;
    
    // Get the requested role
    const requestedRole = role || 'attendee';
    const isElevatedRole = requestedRole === 'moderator' || requestedRole === 'teacher';
    
    // If requesting elevated role (moderator/teacher), must have token.generate permission
    if (isElevatedRole && !canGenerateToken) {
      return res.status(403).json({ 
        error: 'API key does not have permission to generate moderator/teacher tokens',
        requires_permission: 'token.generate'
      });
    }
    
    // Cap permissions based on API key capabilities
    // If no token.generate permission, default to attendee
    const effectiveRole = canGenerateToken ? requestedRole : 'attendee';
    
    // Verify LiveKit credentials are configured
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      return res.status(503).json({ error: 'LiveKit service not configured' });
    }

    // Create access token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity,
      name: name || identity,
      metadata: JSON.stringify({
        ...metadata,
        role,
        source: metadata.source || 'external'
      })
    });
    
    // Add grants based on effective role (capped by API key permissions)
    const isModerator = effectiveRole === 'moderator' || effectiveRole === 'teacher';
    const isPresenter = effectiveRole === 'presenter';
    const isObserver = effectiveRole === 'observer';
    
    token.addGrant({
      room,
      roomJoin: true,
      canPublish: isModerator || isPresenter,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isModerator,
      hidden: isObserver
    });
    
    const jwt = await token.toJwt();
    
    logger.info(`[External API] Generated token for ${identity} in room ${room} (${effectiveRole}) via API key ${apiKeyInfo?.id}`);
    
    res.json({
      token: jwt,
      livekit_url: LIVEKIT_URL,
      identity,
      role,
      join_url: `${FRONTEND_URL}/join/${room}#token=${jwt}`
    });
    
  } catch (error) {
    logger.error('[External API] Error generating token:', error);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * End an active room
 * POST /external/rooms/:name/end
 */
router.post('/rooms/:name/end', async (req: Request, res: Response) => {
  try {
    if (!requireApiKeyPermission(req, res, 'rooms', 'end')) return;

    const { name } = req.params;
    
    // Verify ownership
    const apiKeyInfo = (req as ExternalApiRequest).apiKey;
    const roomOwner = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE name = $1', [name]);
    if (roomOwner && roomOwner.host_id !== apiKeyInfo?.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this room' });
    }
    
    // End room via LiveKit
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const endClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      await endClient.deleteRoom(name);
    } catch {
      // Room might not exist in LiveKit
      logger.info(`[External API] Room ${name} not active in LiveKit`);
    }
    
    // Update any active meetings (join via room_id -> rooms.name)
    await query(
      `UPDATE meetings SET ended_at = NOW(), status = 'ended' 
       WHERE room_id IN (SELECT id FROM rooms WHERE name = $1) AND ended_at IS NULL`,
      [name]
    );
    
    logger.info(`[External API] Ended room: ${name}`);
    
    res.json({ success: true, message: 'Room ended' });
    
  } catch (error) {
    logger.error('[External API] Error ending room:', error);
    res.status(500).json({ error: 'Failed to end room' });
  }
});

/**
 * Delete a room permanently
 * DELETE /external/rooms/:name
 */
router.delete('/rooms/:name', async (req: Request, res: Response) => {
  try {
    if (!requireApiKeyPermission(req, res, 'rooms', 'delete')) return;

    const { name } = req.params;
    
    // Verify ownership
    const apiKeyInfo = (req as ExternalApiRequest).apiKey;
    const roomOwner = await queryOne<{ host_id: string }>('SELECT host_id FROM rooms WHERE name = $1', [name]);
    if (roomOwner && roomOwner.host_id !== apiKeyInfo?.userId) {
      return res.status(403).json({ error: 'Not authorized to modify this room' });
    }
    
    // Delete from LiveKit first (best-effort)
    try {
      const { RoomServiceClient } = await import('livekit-server-sdk');
      const lkClient = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      await lkClient.deleteRoom(name);
    } catch (lkErr) {
      logger.warn('[External API] Failed to delete room from LiveKit:', lkErr);
    }

    // Delete from database
    await query('DELETE FROM rooms WHERE name = $1', [name]);
    
    logger.info(`[External API] Deleted room: ${name}`);
    
    res.json({ success: true, message: 'Room deleted' });
    
  } catch (error) {
    logger.error('[External API] Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ==================== Join Links ====================

interface JoinLinksResponse {
  room: string;
  teacher_url: string;
  student_url: string;
  expires_at?: string;
}

/**
 * Get join links for a room
 * Returns teacher link (with embedded token) and student link (common for all)
 * GET /external/rooms/:name/links
 */
router.get('/rooms/:name/links', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { teacher_identity, teacher_name, expires_in } = req.query;
    
    // Verify room exists
    const room = await queryOne<{ id: string; name: string; title: string }>(
      'SELECT id, name, title FROM rooms WHERE name = $1',
      [name]
    );
    
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    // Check API key has token generation permission
    const apiKeyInfo = (req as ExternalApiRequest).apiKey;
    const permissions = apiKeyInfo?.permissions || {};
    if (!permissions.token || !(permissions.token as Record<string, unknown>).generate) {
      return res.status(403).json({ error: 'API key does not have permission to generate join links' });
    }
    
    // Generate teacher token with moderator privileges
    const teacherIdentity = (teacher_identity as string) || `teacher-${Date.now()}`;
    const teacherName = (teacher_name as string) || 'Teacher';
    
    const teacherToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: teacherIdentity,
      name: teacherName,
      metadata: JSON.stringify({
        role: 'moderator',
        source: 'external-link'
      })
    });
    
    // Moderator grants
    teacherToken.addGrant({
      room: name,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: true,
    });
    
    // Set token expiry (default 24 hours)
    const expiresIn = expires_in ? parseInt(expires_in as string) : 86400; // seconds
    teacherToken.ttl = expiresIn;
    
    const teacherJwt = await teacherToken.toJwt();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    
    const response: JoinLinksResponse = {
      room: name,
      teacher_url: `${FRONTEND_URL}/join/${name}#t=${teacherJwt}&role=moderator`,
      student_url: `${FRONTEND_URL}/join/${name}`,
      expires_at: expiresAt.toISOString(),
    };
    
    logger.info(`[External API] Generated join links for room: ${name}`);
    
    res.json(response);
    
  } catch (error) {
    logger.error('[External API] Error generating join links:', error);
    res.status(500).json({ error: 'Failed to generate join links' });
  }
});

export default router;
