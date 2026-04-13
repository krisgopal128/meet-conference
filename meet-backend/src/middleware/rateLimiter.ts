import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict limiter for auth endpoints
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts per hour
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
});

// Token generation limiter
export const tokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 tokens per minute
  message: { error: 'Too many token requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook limiter (more permissive)
export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 webhooks per minute
  message: { error: 'Too many webhook requests' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Admin action limiter - strict rate limiting for sensitive admin operations
export const adminActionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 admin actions per hour per IP
  message: { error: 'Too many admin actions, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
