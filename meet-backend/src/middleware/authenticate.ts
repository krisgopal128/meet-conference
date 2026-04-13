import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query, queryOne } from '../services/database.js';
import { cacheGet, cacheSet, isTokenBlacklisted } from '../services/redis.js';

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
    console.error('[Audit] Failed to log auth failure:', err);
  }
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Fetch user from DB with Redis caching (TTL: 5 minutes)
 */
async function getUserById(userId: string): Promise<AuthUser | null> {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  try {
    const cached = await cacheGet<AuthUser>(cacheKey);
    if (cached) return cached;
  } catch {
    // Cache miss, fall through to DB
  }

  // Fetch from DB
  const user = await queryOne<AuthUser>(
    'SELECT id, email, name, role FROM users WHERE id = $1',
    [userId]
  );

  // Cache result for 5 minutes (ignore cache errors)
  if (user) {
    cacheSet(cacheKey, user, 300).catch(() => {});
  }

  return user;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  // Debug logging for auth issues
  console.log(`[Auth] ${req.method} ${req.path} - Authorization header: ${authHeader ? 'present' : 'MISSING'}`);

  if (!authHeader?.startsWith('Bearer ')) {
    console.log(`[Auth] Missing/invalid header for ${req.path}`);
    logFailedAuthAttempt('missing_header', req).catch(() => {});
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    // Check if token is blacklisted
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      logFailedAuthAttempt('token_revoked', req).catch(() => {});
      res.status(401).json({ error: 'Token has been revoked' });
      return;
    }

    const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
    
    const user = await getUserById(payload.userId);

    if (!user) {
      logFailedAuthAttempt('user_not_found', req).catch(() => {});
      res.status(401).json({ error: 'User not found' });
      return;
    }

    (req as AuthRequest).user = user;
    
    // Log user login activity (non-blocking)
    const ipAddress = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.headers['user-agent'] || null;
    
    query(
      `INSERT INTO user_activity (user_id, activity_type, metadata, ip_address, user_agent)
       VALUES ($1, 'login', $2, $3, $4)`,
      [user.id, JSON.stringify({ method: 'jwt' }), ipAddress, userAgent]
    ).catch(err => console.error('Failed to log login activity:', err));
    
    // Update last_login_at (non-blocking)
    query(
      'UPDATE users SET last_login_at = NOW() WHERE id = $1',
      [user.id]
    ).catch(err => console.error('Failed to update last_login_at:', err));
    
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
    // Check if token is blacklisted - if so, treat as unauthenticated
    const blacklisted = await isTokenBlacklisted(token);
    if (blacklisted) {
      next();
      return;
    }

    const payload = jwt.verify(token, config.jwt.secret) as { userId: string };
    
    const user = await getUserById(payload.userId);

    if (user) {
      (req as AuthRequest).user = user;
    }
    next();
  } catch {
    next();
  }
}
