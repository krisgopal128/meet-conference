/**
 * CSRF Protection Middleware (Double-Submit Cookie Pattern)
 *
 * On login, server issues a csrf_token cookie.
 * Client reads cookie and sends as X-CSRF-Token header.
 * Middleware validates header matches cookie.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger.js';

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

const CSRF_SKIP_PATHS = new Set([
  '/health', '/webhook',
  '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password',
  '/auth/refresh',
  '/token/guest',
  '/external',
]);
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function issueCsrfToken(res: Response, token?: string): string {
  const csrfToken = token || generateCsrfToken();
  const req = res.req as Request & { secure?: boolean };
  const forwarded = req.headers['x-forwarded-proto'];
  const isSecure = (typeof forwarded === 'string' && forwarded.startsWith('https')) || req.secure;
  res.cookie(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false,
    sameSite: 'lax',
    secure: !!isSecure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return csrfToken;
}

export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  if (!CSRF_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const path = req.path.toLowerCase();
  for (const skipPath of CSRF_SKIP_PATHS) {
    if (path === skipPath || path.startsWith(skipPath + '/')) return next();
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME] as string | undefined;

  if (!cookieToken || !headerToken) {
    logger.warn('[CSRF] Missing token', { path: req.path, hasCookie: !!cookieToken, hasHeader: !!headerToken });
    res.status(403).json({ error: 'CSRF token missing' });
    return;
  }

  if (cookieToken.length !== headerToken.length ||
      !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warn('[CSRF] Token mismatch', { path: req.path });
    res.status(403).json({ error: 'CSRF token mismatch' });
    return;
  }

  next();
}
