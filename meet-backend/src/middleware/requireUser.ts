/**
 * Helper to require a user from AuthRequest
 * Returns the user object or null if not authenticated
 */

import { AuthRequest } from './authenticate.js';

export function requireUser(req: AuthRequest): { id: string; email: string; name: string | null } | null {
  return req.user ?? null;
}

/**
 * Require user or return 401 response
 * Use in routes where you want automatic 401 handling
 */
export function requireUserOr401(req: AuthRequest): { id: string; email: string; name: string | null } {
  if (!req.user) {
    throw new Error('AUTH_REQUIRED');
  }
  return req.user;
}

export class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}
