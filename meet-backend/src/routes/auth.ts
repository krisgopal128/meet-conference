import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query, queryOne } from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { blacklistToken, cacheGet, cacheSet } from '../services/redis.js';
import { invalidateTokenAuth, invalidateUserAuth } from '../middleware/authenticate.js';
import { 
  sanitizeEmail, 
  sanitizeName, 
  sanitizeUrl, 
  validatePassword 
} from '../utils/validation.js';
import logger from '../utils/logger.js';
import { issueCsrfToken } from '../middleware/csrf.js';

export const authRouter = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
  rememberMe: z.boolean().optional().default(false),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  rememberMe: z.boolean().optional().default(false),
});

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  avatarUrl: z.string().url().optional(),
});

// Token expiration times
const TOKEN_EXPIRY_SHORT = '7d';     // 7 days (default)
const TOKEN_EXPIRY_LONG = '30d';     // 30 days (remember me)

// Account lockout configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 15 * 60; // 15 minutes

/**
 * Check if an account is locked out due to too many failed login attempts
 */
async function isAccountLocked(email: string): Promise<{ locked: boolean; remainingSeconds: number }> {
  const key = `lockout:${email}`;
  const attempts = await cacheGet<number>(key);
  if (attempts !== null && attempts >= MAX_FAILED_ATTEMPTS) {
    // Get remaining TTL directly from Redis key
    const { cacheTTL } = await import('../services/redis.js');
    const remainingTTL = await cacheTTL(key);
    return { locked: true, remainingSeconds: remainingTTL > 0 ? remainingTTL : LOCKOUT_DURATION_SECONDS };
  }
  return { locked: false, remainingSeconds: 0 };
}

/**
 * Record a failed login attempt for an email
 */
async function recordFailedAttempt(email: string): Promise<void> {
  const key = `lockout:${email}`;
  const attempts = await cacheGet<number>(key);
  const newAttempts = (attempts || 0) + 1;
  
  // Set or update the attempt counter with TTL
  await cacheSet(key, newAttempts, LOCKOUT_DURATION_SECONDS);
  

}

/**
 * Clear failed attempts after successful login
 */
async function clearFailedAttempts(email: string): Promise<void> {
  const key = `lockout:${email}`;
  const { cacheDel } = await import('../services/redis.js');
  await cacheDel(key);
}

// POST /auth/register
authRouter.post('/register', authLimiter, async (req, res: Response) => {
  try {
    const rawData = registerSchema.parse(req.body);
    
    // Sanitize inputs
    const email = sanitizeEmail(rawData.email);
    const password = rawData.password;
    const name = rawData.name ? sanitizeName(rawData.name) : null;
    
    // Validate password strength
    validatePassword(password);

    // Check if user exists
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existing) {
      // Use generic message to prevent user enumeration
      return res.status(400).json({ error: 'Unable to complete registration' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const [user] = await query<{ id: string; email: string; name: string | null; role: string }>(
      `INSERT INTO users (email, password_hash, name) 
       VALUES ($1, $2, $3) 
       RETURNING id, email, name, role`,
      [email, passwordHash, name]
    );

    // Generate token (30 days if remember me, 7 days otherwise)
    const token = jwt.sign(
      { userId: user.id }, 
      config.jwt.secret, 
      { expiresIn: rawData.rememberMe ? TOKEN_EXPIRY_LONG : TOKEN_EXPIRY_SHORT }
    );

    // Issue CSRF token cookie for subsequent state-changing requests
    issueCsrfToken(res);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// POST /auth/login
authRouter.post('/login', authLimiter, async (req, res: Response) => {
  try {
    const rawData = loginSchema.parse(req.body);
    
    // Sanitize email
    const email = sanitizeEmail(rawData.email);
    const password = rawData.password;

    // Check if account is locked out
    const { locked, remainingSeconds } = await isAccountLocked(email);
    if (locked) {
      return res.status(429).json({ 
        error: 'Account temporarily locked due to too many failed attempts',
        retryAfter: remainingSeconds 
      });
    }

    // Find user
    const user = await queryOne<{ id: string; email: string; name: string | null; password_hash: string; role: string; is_banned: boolean }>(
      'SELECT id, email, name, password_hash, role, is_banned FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // Record failed attempt (use sanitized email to prevent enumeration via timing)
      await recordFailedAttempt(email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check if user is banned
    if (user.is_banned) {
      return res.status(403).json({ error: 'This account has been suspended. Please contact an administrator.' });
    }


    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      // Record failed attempt
      await recordFailedAttempt(email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Clear failed attempts on successful login
    await clearFailedAttempts(email);

    // Generate token (30 days if remember me, 7 days otherwise)
    const token = jwt.sign(
      { userId: user.id }, 
      config.jwt.secret, 
      { expiresIn: rawData.rememberMe ? TOKEN_EXPIRY_LONG : TOKEN_EXPIRY_SHORT }
    );

    // Issue CSRF token cookie for subsequent state-changing requests
    issueCsrfToken(res);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && error.message.includes('Invalid')) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /auth/me - Get current user
authRouter.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// POST /auth/refresh - Refresh token
authRouter.post('/refresh', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get fresh user data
    const user = await queryOne<{ id: string; email: string; name: string | null; role: string }>(
      'SELECT id, email, name, role FROM users WHERE id = $1',
      [req.user.id]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Preserve remember-me: if old token has >7d TTL remaining, it was a long-lived token
    const oldToken = req.headers.authorization?.slice(7);
    let useLongExpiry = false;
    if (oldToken) {
      try {
        const decoded = jwt.decode(oldToken) as { exp?: number } | null;
        if (decoded?.exp) {
          const remaining = decoded.exp - Math.floor(Date.now() / 1000);
          // If remaining TTL > TOKEN_EXPIRY_SHORT (7d in seconds), it was a remember-me token
          useLongExpiry = remaining > 7 * 24 * 60 * 60;
        }
      } catch {}
    }

    const token = jwt.sign(
      { userId: user.id }, 
      config.jwt.secret, 
      { expiresIn: useLongExpiry ? TOKEN_EXPIRY_LONG : TOKEN_EXPIRY_SHORT }
    );

    // Blacklist old token
    if (oldToken) {
      try {
        const ttl = useLongExpiry
          ? Math.max(30 * 24 * 60 * 60, 86400)
          : 86400;
        // Re-decode for TTL (already decoded above for useLongExpiry check)
        const decoded = jwt.decode(oldToken) as { exp?: number } | null;
        const actualTtl = decoded?.exp ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1) : ttl;
        await blacklistToken(oldToken, actualTtl);
        invalidateTokenAuth(oldToken);
      } catch (blacklistError) {
        logger.error('Failed to blacklist old token on refresh:', blacklistError);
      }
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// PATCH /auth/profile - Update profile
authRouter.patch('/profile', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const rawData = updateProfileSchema.parse(req.body);
    
    // Sanitize inputs
    const name = rawData.name !== undefined ? (rawData.name ? sanitizeName(rawData.name) : null) : undefined;
    const avatarUrl = rawData.avatarUrl !== undefined ? (rawData.avatarUrl ? sanitizeUrl(rawData.avatarUrl) : null) : undefined;

    // Build dynamic SET clause — only include fields that are defined (not undefined).
    // If a field is explicitly null, set it to NULL (allows clearing).
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(name);
    }
    if (avatarUrl !== undefined) {
      setClauses.push(`avatar_url = $${paramIdx++}`);
      params.push(avatarUrl);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.user!.id);
    const [updated] = await query<{ id: string; email: string; name: string | null; avatar_url: string | null }>(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIdx} RETURNING id, email, name, avatar_url`,
      params
    );

    res.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    if (error instanceof Error && (error.message.includes('Invalid') || error.message.includes('cannot'))) {
      return res.status(400).json({ error: error.message });
    }
    logger.error('Profile update error:', error);
    res.status(500).json({ error: 'Profile update failed' });
  }
});

// POST /auth/forgot-password - Request password reset
authRouter.post('/forgot-password', authLimiter, async (req, res: Response) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    const sanitizedEmail = sanitizeEmail(email);
    
    // Check if user exists
    const user = await queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM users WHERE email = $1',
      [sanitizedEmail]
    );
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }
    
    // Generate password reset token (JWT with 1-hour expiry)
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
    
    // Store token hash in Redis for revocation capability
    const { createHash } = await import('crypto');
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    await cacheSet(`password-reset:${tokenHash}`, { userId: user.id }, 3600);
    
    logger.info(`[Auth] Password reset requested for user ${user.id}`);
    
    // TODO: Send email with reset link containing the token
    // For now the token is logged and can be used for testing
    res.json({ 
      message: 'If an account with that email exists, a reset link has been sent.',
      ...(config.nodeEnv === 'development' && { resetToken })
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  }
});
// POST /auth/reset-password - Reset password with token
authRouter.post('/reset-password', authLimiter, async (req, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }
    
    // Validate password strength
    try {
      validatePassword(password);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
    
    // Verify reset token
    let decoded: { userId: string; purpose: string };
    try {
      decoded = jwt.verify(token, config.jwt.secret) as { userId: string; purpose: string };
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Verify it's a password reset token
    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    
    // Verify token exists in Redis (not already used)
    const { createHash: ch } = await import('crypto');
    const resetTokenHash = ch('sha256').update(token).digest('hex');
    const resetEntry = await cacheGet<{ userId: string }>(`password-reset:${resetTokenHash}`);
    if (!resetEntry) {
      return res.status(400).json({ error: 'Reset token has already been used or expired' });
    }
    
    // Delete the reset token from Redis to prevent reuse
    const { cacheDel } = await import('../services/redis.js');
    await cacheDel(`password-reset:${resetTokenHash}`);

    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Update user password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, decoded.userId]
    );
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    logger.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// POST /auth/logout - Blacklist token for proper invalidation
authRouter.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      // Decode to get expiry (token is already verified by authenticate middleware)
      const decoded = jwt.decode(token) as { exp?: number } | null;
      const ttl = decoded?.exp ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1) : 86400;
      await blacklistToken(token, ttl);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // Even if blacklisting fails, return success (client should remove token)
    logger.error('Logout blacklist error:', error);
    res.json({ message: 'Logged out successfully' });
  }
});
