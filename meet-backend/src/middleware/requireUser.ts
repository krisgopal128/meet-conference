/**
 * Helper to require a user from AuthRequest
 * Returns the user object or null if not authenticated
 */

import { AuthRequest } from './authenticate.js';

export function requireUser(req: AuthRequest): { id: string; email: string; name: string | null } | null {
  return req.user ?? null;
}

export class AuthenticationError extends Error {
  statusCode = 401;
  constructor(message = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}
