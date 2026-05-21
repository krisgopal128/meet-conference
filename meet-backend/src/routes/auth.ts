import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { config } from '../config.js';
import { query, queryOne } from '../services/database.js';
import { AuthRequest, authenticate } from '../middleware/authenticate.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { blacklistToken, cacheGet, cacheSet } from '../services/redis.js';
import { 
  sanitizeEmail, 
  sanitizeName, 
  sanitizeUrl, 
  validatePassword 
} from '../utils/validation.js';
import logger from '../utils/logger.js';

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
    // Get remaining TTL
    const ttl = await cacheGet<number>(`${key}:ttl`);
    return { locked: true, remainingSeconds: ttl || LOCKOUT_DURATION_SECONDS };
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
  
  // Store TTL separately for quick lookup
  if (newAttempts === 1) {
    await cacheSet(`${key}:ttl`, LOCKOUT_DURATION_SECONDS, LOCKOUT_DURATION_SECONDS);
  }
}

/**
 * Clear failed attempts after successful login
 */
async function clearFailedAttempts(email: string): Promise<void> {
  const key = `lockout:${email}`;
  await cacheSet(key, 0, 1); // Effectively delete by setting TTL to 1 second
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
    const user = await queryOne<{ id: string; email: string; name: string | null; password_hash: string; role: string }>(
      'SELECT id, email, name, password_hash, role FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // Record failed attempt (use sanitized email to prevent enumeration via timing)
      await recordFailedAttempt(email);
      return res.status(401).json({ error: 'Invalid credentials' });
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

    // Generate new token (default 7 days, refresh doesn't extend to 30 days)
    const token = jwt.sign(
      { userId: user.id }, 
      config.jwt.secret, 
      { expiresIn: TOKEN_EXPIRY_SHORT }
    );

    // Blacklist old token
    const oldToken = req.headers.authorization?.slice(7);
    if (oldToken) {
      try {
        const decoded = jwt.decode(oldToken) as { exp?: number } | null;
        const ttl = decoded?.exp ? Math.max(decoded.exp - Math.floor(Date.now() / 1000), 1) : 86400;
        await blacklistToken(oldToken, ttl);
      } catch (blacklistError) {
        logger.error('Failed to blacklist old token on refresh:', blacklistError);
        // Continue — new token is still valid
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
    const name = rawData.name ? sanitizeName(rawData.name) : undefined;
    const avatarUrl = rawData.avatarUrl ? sanitizeUrl(rawData.avatarUrl) : undefined;

    const [updated] = await query<{ id: string; email: string; name: string | null; avatar_url: string | null }>(
      `UPDATE users 
       SET name = COALESCE($1, name), avatar_url = COALESCE($2, avatar_url)
       WHERE id = $3
       RETURNING id, email, name, avatar_url`,
      [name, avatarUrl, req.user!.id]
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
    
    // In production, send email with reset link
    // SECURITY: Never return the token in response, even in development
    res.json({ 
      message: 'If an account with that email exists, a reset link has been sent.' 
    });
  } catch (error) {
    logger.error('Forgot password error:', error);
    // Still return success to prevent email enumeration
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
