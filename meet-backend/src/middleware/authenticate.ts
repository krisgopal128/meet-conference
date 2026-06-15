import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';
import { query, queryOne } from '../services/database.js';
import { cacheGet, cacheSet, cacheDel, isTokenBlacklisted } from '../services/redis.js';
import { cacheExists } from '../services/redis.js';
import logger from '../utils/logger.js';

/**
 * Log failed authentication attempts to audit log
 * Does NOT log sensitive data like tokens or emails in plain text
 */
async function logFailedAuthAttempt(
  reason: 'missing_header' | 'invalid_format' | 'token_revoked' | 'token_expired' | 'invalid_token' | 'user_not_found',
  req: Request
): Promise<void> {
  const ipAddress = req.ip || req.socket.remoteAddress || null;
  const userAgent = req.headers['user-agent'] || null;

  try {
    await query(
      `INSERT INTO admin_audit_logs (action_type, target_type, details, ip_address)
       VALUES ('auth_failed', 'authentication', $1, $2)`,
      [JSON.stringify({ 
        reason, 
        path: req.path,
        user_agent: userAgent ? userAgent.substring(0, 255) : null 
      }), ipAddress]
    );
  } catch (err) {
    // Don't fail the request if audit logging fails
    logger.error('[Audit] Failed to log auth failure:', err);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  is_banned?: boolean;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ---- Token-level auth cache ----
// Caches the full authentication result (user data) keyed by SHA256(token).
// One Redis GET replaces: blacklist check + jwt.verify + getUserById DB lookup.
const TOKEN_CACHE_PREFIX='tk:auth:';
const TOKEN_CACHE_TTL=60; // 60 seconds — SHORT tier

function tokenHash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function tokenCacheKey(token: string): string {
  return `${TOKEN_CACHE_PREFIX}${tokenHash(token)}`;
}

/**
 * Cache a validated token → user mapping (non-blocking write).
 */
function cacheTokenAuth(token: string, user: AuthUser): void {
  cacheSet(tokenCacheKey(token), user, TOKEN_CACHE_TTL).catch(() => {
    // Ignore cache write failures — auth still works via full verification
  });
}

/**
 * Invalidate a cached token auth entry (e.g., on logout, refresh, role change).
 */
export function invalidateTokenAuth(token: string): void {
  cacheDel(tokenCacheKey(token)).catch(() => {});
}

/**
 * Invalidate all cached tokens for a user by deleting the user cache entry.
 * The token cache entries will naturally expire (max 60s).
 * Call this when user data (role, email, name) changes.
 */
export function invalidateUserAuth(userId: string): void {
  cacheDel(`user:${userId}`).catch(() => {});
}

/**
 * Set a banned marker in Redis for a user. Token cache hits will check this.
 * Call from admin ban endpoint.
 */
export function setUserBanned(userId: string, ttlSeconds = 86400): void {
  cacheSet(`banned:${userId}`, Date.now(), ttlSeconds).catch(() => {});
}

/**
 * Remove the banned marker when a user is unbanned.
 */
export function clearUserBanned(userId: string): void {
  cacheDel(`banned:${userId}`).catch(() => {});
}

/**
 * Invalidate all token cache entries for a user.
 * Clears user cache and banned marker so next auth does a fresh DB lookup.
 */
export function invalidateAllTokenCacheForUser(userId: string): void {
  invalidateUserAuth(userId);
  cacheDel(`banned:${userId}`).catch(() => {});
}

/**
 * Fetch user from DB with Redis caching (TTL: 5 minutes)
 */
async function getUserById(userId: string): Promise<AuthUser | null> {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  try {
    const cached = await cacheGet<AuthUser>(cacheKey);
if (cached) {
      if (cached.is_banned) return null; // Force re-auth for banned users
      return cached;
    }
  } catch {
    // Cache miss, fall through to DB
  }

  // Fetch from DB
  const user = await queryOne<AuthUser>(
    'SELECT id, email, name, role, is_banned FROM users WHERE id = $1',
    [userId]
  );

   // Cache result for 5 minutes (ignore cache errors)
   if (user) {
     cacheSet(cacheKey, user, 300).catch((err) => {
       logger.warn('[AuthCache] Failed to cache user:', err);
     });
   }

  return user;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    logFailedAuthAttempt('missing_header', req).catch(() => {});
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
       logFailedAuthAttempt('token_revoked', req).catch(() => {});
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    // Fast path: check token-level auth cache first
    // One Redis GET replaces: blacklist check + jwt.verify + DB lookup
    try {
      const cached = await cacheGet<AuthUser>(tokenCacheKey(token));
     if (cached) {
        // Check banned status in Redis (set by admin ban endpoint)
        if (cached.id) {
          try {
            const isBanned = await cacheExists(`banned:${cached.id}`);
            if (isBanned) {
              res.status(403).json({ error: 'Account suspended' });
              return;
            }
          } catch {
            // If Redis check fails, proceed with cached data (best effort)
          }
        }
       // Re-check ban status even on cache hit — prevents 60s bypass window
        if (cached.is_banned) {
          res.status(403).json({ error: 'Account suspended' });
          return;
        }
        (req as AuthRequest).user = cached;
        next();
        return;
      }
    } catch {
      // Cache read failed — fall through to full verification
    }

    // Full verification path (cache miss)
    const allowExpired = req.path === '/auth/refresh';
    const verifyOptions: jwt.VerifyOptions = allowExpired
      ? { ignoreExpiration: true, algorithms: ['HS256'] }
      : { algorithms: ['HS256'] };
    const payload = jwt.verify(token, config.jwt.secret, verifyOptions) as { userId: string; type?: string };
    if (payload.type && payload.type !== 'access') {
       logFailedAuthAttempt('invalid_token', req).catch(() => {});
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    
    const user = await getUserById(payload.userId);

    if (!user) {
       logFailedAuthAttempt('user_not_found', req).catch(() => {});
      res.status(401).json({ error: 'User not found' });
      return;
    }

    // Check if user is banned
    if (user.is_banned) {
      res.status(403).json({ error: 'Account suspended' });
      return;
    }

    (req as AuthRequest).user = user;

    // Cache the token → user mapping for subsequent requests (non-blocking)
    cacheTokenAuth(token, user);

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
       logFailedAuthAttempt('token_expired', req).catch(() => {});
      res.status(401).json({ error: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
       logFailedAuthAttempt('invalid_token', req).catch(() => {});
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    next(error);
  }
}

// Optional authentication - doesn't fail if no token
export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Fast path: check token-level auth cache first
    try {
      const cached = await cacheGet<AuthUser>(tokenCacheKey(token));
      if (cached) {
        if (cached.is_banned) {
          next();
          return;
        }
        (req as AuthRequest).user = cached;
        next();
        return;
      }
    } catch {
      // Cache read failed — fall through to full verification
    }

    // Check if token is blacklisted - if so, treat as unauthenticated
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      next();
      return;
    }

    const payload = jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] }) as { userId: string };
    
    const user = await getUserById(payload.userId);

    if (user) {
      // Don't set user on request if banned
      if (user.is_banned) {
        next();
        return;
      }
      (req as AuthRequest).user = user;
      // Cache the token → user mapping (non-blocking)
      cacheTokenAuth(token, user);
    }
    next();
  } catch {
    next();
  }
}
