/**
 * Role-Based Access Control Middleware
 * 
 * Restricts routes to specific user roles (admin, moderator, participant).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';

export type UserRole = 'admin' | 'moderator' | 'participant';

/**
 * Middleware factory that requires specific roles.
 * 
 * @param allowedRoles - Array of roles that can access the route
 * @returns Express middleware function
 * 
 * @example
 * // Require admin only
 * router.delete('/users/:id', requireRole('admin'), deleteUser);
 * 
 * @example
 * // Require admin or moderator
 * router.get('/users', requireRole('admin', 'moderator'), listUsers);
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED' 
      });
    }

    // Get user role (default to participant if not set)
    const userRole = (req.user.role as UserRole) || 'participant';

    // Check if user has required role
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        code: 'FORBIDDEN',
        required: allowedRoles,
        current: userRole
      });
    }

    next();
  };
}

/**
 * Require admin role only.
 * Convenience wrapper for requireRole('admin').
 */
export function requireAdmin() {
  return requireRole('admin');
}

/**
 * Require admin or moderator role.
 * Convenience wrapper for requireRole('admin', 'moderator').
 */
export function requireModerator() {
  return requireRole('admin', 'moderator');
}

/**
 * Check if user has a specific role (without middleware).
 * Useful for conditional logic in route handlers.
 */
export function hasRole(user: { role?: string } | undefined, ...roles: UserRole[]): boolean {
  if (!user) return false;
  const userRole = (user.role as UserRole) || 'participant';
  return roles.includes(userRole);
}

/**
 * Check if user is admin.
 */
export function isAdmin(user: { role?: string } | undefined): boolean {
  return hasRole(user, 'admin');
}

/**
 * Check if user is admin or moderator.
 */
export function isModerator(user: { role?: string } | undefined): boolean {
  return hasRole(user, 'admin', 'moderator');
}
