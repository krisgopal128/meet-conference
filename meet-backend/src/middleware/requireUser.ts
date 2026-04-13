/**
 * Helper to require a user from AuthRequest
 */

import { AuthRequest } from './authenticate.js';

export function requireUser(req: AuthRequest): { id: string; email: string; name: string | null } {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  return req.user;
}
