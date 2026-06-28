import { Router, Response, Request } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { StringValue } from 'ms';
import { z } from 'zod';
import { config } from '../config.js';
import { query, queryOne, withTransaction } from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { blacklistToken, cacheGet, cacheSet, cacheTTL, cacheIncrWithExpire, cacheDel } from '../services/redis.js';
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

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

// Token expiration times
const ACCESS_TOKEN_EXPIRY: StringValue = '15m';
const REFRESH_TOKEN_EXPIRY_SHORT: StringValue = '7d';
const REFRESH_TOKEN_EXPIRY_LONG: StringValue = '30d';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

function reqProtocol(res: Response): string {
  const req = res.req as Request;
  return req.protocol;
}

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
  await cacheIncrWithExpire(key, LOCKOUT_DURATION_SECONDS);
}

/**
 * Clear failed attempts after successful login
 */
async function clearFailedAttempts(email: string): Promise<void> {
  const key = `lockout:${email}`;
  await cacheDel(key);
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createAccessToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'access' },
    config.jwt.secret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function getRefreshExpiry(rememberMe: boolean): { tokenExpiry: StringValue; expiresAt: Date } {
  const expiresAt = new Date();
  if (rememberMe) {
    expiresAt.setDate(expiresAt.getDate() + 30);
    return { tokenExpiry: REFRESH_TOKEN_EXPIRY_LONG, expiresAt };
  }

  expiresAt.setDate(expiresAt.getDate() + 7);
  return { tokenExpiry: REFRESH_TOKEN_EXPIRY_SHORT, expiresAt };
}

function createRefreshToken(userId: string, rememberMe: boolean): { token: string; expiresAt: Date } {
  const { tokenExpiry, expiresAt } = getRefreshExpiry(rememberMe);
  const token = jwt.sign(
    { userId, type: 'refresh' },
    config.jwt.secret,
    { expiresIn: tokenExpiry }
  );
  return { token, expiresAt };
}

async function storeRefreshToken(userId: string, refreshToken: string, expiresAt: Date): Promise<void> {
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
     VALUES ($1, $2, $3, false)`,
    [userId, hashToken(refreshToken), expiresAt]
  );
}

function setRefreshTokenCookie(res: Response, refreshToken: string, expiresAt: Date): void {
  const isSecure = reqProtocol(res) === 'https';
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: isSecure ? 'lax' : 'strict',
    secure: isSecure,
    path: '/',
    expires: expiresAt,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  const isSecure = reqProtocol(res) === 'https';
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    sameSite: isSecure ? 'lax' : 'strict',
    secure: isSecure,
    path: '/',
  });
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

    const { user, refresh } = await withTransaction(async (client) => {
      const userResult = await client.query<{ id: string; email: string; name: string | null; role: string; feature_flags: Record<string, boolean> | null }>(
        `INSERT INTO users (email, password_hash, name) 
         VALUES ($1, $2, $3) 
         RETURNING id, email, name, role, feature_flags`,
        [email, passwordHash, name]
      );
      const newUser = userResult.rows[0];

      const newRefresh = createRefreshToken(newUser.id, rawData.rememberMe);
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked)
         VALUES ($1, $2, $3, false)`,
        [newUser.id, hashToken(newRefresh.token), newRefresh.expiresAt]
      );

      return { user: newUser, refresh: newRefresh };
    });

    const token = createAccessToken(user.id);

    // Issue CSRF token cookie for subsequent state-changing requests
    issueCsrfToken(res);
    setRefreshTokenCookie(res, refresh.token, refresh.expiresAt);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        featureFlags: user.feature_flags ?? null,
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
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === '23505') {
      return res.status(409).json({ error: 'Unable to complete registration' });
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
    const { locked, remainingSeconds } = await isAccountLocked(email).catch(() => ({ locked: false, remainingSeconds: 0 }));
    if (locked) {
      return res.status(429).json({ 
        error: 'Account temporarily locked due to too many failed attempts',
        retryAfter: remainingSeconds 
      });
    }

    // Find user
    const user = await queryOne<{ id: string; email: string; name: string | null; password_hash: string; role: string; is_banned: boolean; feature_flags: Record<string, boolean> | null }>(
      'SELECT id, email, name, password_hash, role, is_banned, feature_flags FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // Record failed attempt (use sanitized email to prevent enumeration via timing)
      await recordFailedAttempt(email).catch(() => {});
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
      await recordFailedAttempt(email).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Clear failed attempts on successful login
    await clearFailedAttempts(email).catch(() => {});

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);

    const token = createAccessToken(user.id);
    const refresh = createRefreshToken(user.id, rawData.rememberMe);
    await storeRefreshToken(user.id, refresh.token, refresh.expiresAt);

    issueCsrfToken(res);
    setRefreshTokenCookie(res, refresh.token, refresh.expiresAt);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        featureFlags: user.feature_flags ?? null,
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
authRouter.post('/refresh', async (req, res: Response) => {
  try {
    // Clean up expired refresh tokens (fire-and-forget, non-blocking)
    query('DELETE FROM refresh_tokens WHERE expires_at < NOW()').catch(() => {});

    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (!refreshToken) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'Refresh token missing' });
    }

    const payload = jwt.verify(refreshToken, config.jwt.secret, { algorithms: ['HS256'] }) as { userId: string; type?: string };
    if (payload.type !== 'refresh') {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const refreshTokenHash = hashToken(refreshToken);
    // Atomically revoke the token and retrieve the user_id.
    // The conditional UPDATE (revoked = false) ensures only one concurrent
    // request can succeed — preventing refresh token replay races.
    const storedRefreshToken = await queryOne<{ user_id: string }>(
      `UPDATE refresh_tokens SET revoked = true
       WHERE token_hash = $1 AND revoked = false AND expires_at > NOW()
       RETURNING user_id`,
      [refreshTokenHash]
    );

    if (!storedRefreshToken || storedRefreshToken.user_id !== payload.userId) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'Refresh token revoked or expired' });
    }

    // Get fresh user data
    const user = await queryOne<{ id: string; email: string; name: string | null; role: string; feature_flags: Record<string, boolean> | null }>(
      'SELECT id, email, name, role, feature_flags FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!user) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: 'User not found' });
    }

    const oldAccessToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    if (oldAccessToken) {
      try {
        const decoded = jwt.decode(oldAccessToken) as { exp?: number } | null;
        const actualTtl = decoded?.exp ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1) : 86400;
        await blacklistToken(oldAccessToken, actualTtl);
        invalidateTokenAuth(oldAccessToken);
      } catch (blacklistError) {
        logger.error('Failed to blacklist old access token on refresh:', blacklistError);
      }
    }

    const rememberMe = (() => {
      const decoded = jwt.decode(refreshToken) as { exp?: number } | null;
      if (!decoded?.exp) return false;
      const remaining = decoded.exp - Math.floor(Date.now() / 1000);
      return remaining > 7 * 24 * 60 * 60;
    })();

    const token = createAccessToken(user.id);
    const nextRefresh = createRefreshToken(user.id, rememberMe);
    await storeRefreshToken(user.id, nextRefresh.token, nextRefresh.expiresAt);
    setRefreshTokenCookie(res, nextRefresh.token, nextRefresh.expiresAt);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        featureFlags: user.feature_flags ?? null,
      },
      token,
    });
  } catch (error) {
    clearRefreshTokenCookie(res);
    logger.error('Refresh token error:', error);
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }
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
    const { email } = forgotPasswordSchema.parse(req.body);
    
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
    const resetSecret = config.jwt.secret + ':reset';
    const resetToken = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      resetSecret,
      { expiresIn: '1h' }
    );
    
    // Store token hash in Redis for revocation capability
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    await cacheSet(`password-reset:${tokenHash}`, { userId: user.id }, 3600);
    
    logger.info(`[Auth] Password reset requested for user ${user.id}`);
    
    // TODO: Send email with reset link containing the token
    // For now the token is logged and can be used for testing
    res.json({ 
      message: 'If an account with that email exists, a reset link has been sent.',
      ...(config.nodeEnv === 'development' && { resetToken })
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    logger.error('Forgot password error:', error);
    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  }
});
// POST /auth/reset-password - Reset password with token
authRouter.post('/reset-password', authLimiter, async (req, res: Response) => {
  try {
    const { token, password } = resetPasswordSchema.parse(req.body);
    
    // Validate password strength
    try {
      validatePassword(password);
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
    
    // Verify reset token
    let decoded: { userId: string; purpose: string };
    try {
      decoded = jwt.verify(token, config.jwt.secret + ':reset', { algorithms: ['HS256'] }) as { userId: string; purpose: string };
    } catch {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
    
    // Verify it's a password reset token
    if (decoded.purpose !== 'password-reset') {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    
    // Verify token exists in Redis (not already used)
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetEntry = await cacheGet<{ userId: string }>(`password-reset:${resetTokenHash}`);
    if (!resetEntry) {
      return res.status(400).json({ error: 'Reset token has already been used or expired' });
    }
    
    // Delete the reset token from Redis to prevent reuse
    await cacheDel(`password-reset:${resetTokenHash}`);

    
    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Update user password
    await query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, decoded.userId]
    );

    await query('UPDATE refresh_tokens SET revoked = true WHERE user_id = $1', [decoded.userId]);
    invalidateUserAuth(decoded.userId);
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
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
      invalidateTokenAuth(token);
    }

    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE] as string | undefined;
    if (refreshToken) {
      await query('UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1', [hashToken(refreshToken)]);
    }
    clearRefreshTokenCookie(res);
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // Even if blacklisting fails, return success (client should remove token)
    logger.error('Logout blacklist error:', error);
    clearRefreshTokenCookie(res);
    res.json({ message: 'Logged out successfully' });
  }
});
