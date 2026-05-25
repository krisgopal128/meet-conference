import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser, useIsAuthenticated } from '../store/authStore';
import type { User } from '../types';

/**
 * Hook to protect routes based on user roles.
 * Redirects to login if not authenticated, or to home if not authorized.
 *
 * @param allowedRoles - List of roles that can access the protected route
 * @returns user and authorization status
 *
 * @example
 * // In a component
 * const { user, isAuthorized } = useRequireRole('admin', 'moderator');
 *
 * if (!isAuthorized) {
 *   return null; // or loading state
 * }
 */
export function useRequireRole(...allowedRoles: string[]): {
  user: User | null;
  isAuthorized: boolean;
  isLoading: boolean;
} {
  const navigate = useNavigate();
  const user = useUser();
  const isAuthenticated = useIsAuthenticated();

  // Use ref to avoid rest-param array creating new reference each render
  const rolesRef = useRef(allowedRoles);
  rolesRef.current = allowedRoles;
  const rolesKey = rolesRef.current.join(',');

  useEffect(() => {
    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      navigate('/login', { replace: true });
      return;
    }

    // If authenticated but no user data yet, wait
    if (!user) {
      return;
    }

    // Check if user has required role
    const userRole = user.role || 'participant';
    if (!rolesRef.current.includes(userRole)) {
      // User doesn't have required role, redirect to home
      navigate('/', { replace: true });
    }
  }, [user, isAuthenticated, rolesKey, navigate]);

  const userRole = user?.role || 'participant';
  const isAuthorized = isAuthenticated && user !== null && allowedRoles.includes(userRole);

  return {
    user,
    isAuthorized,
    isLoading: isAuthenticated && user === null,
  };
}

/**
 * Hook specifically for admin-only routes.
 * Convenience wrapper around useRequireRole.
 */
export function useRequireAdmin() {
  return useRequireRole('admin');
}

/**
 * Hook for admin or moderator routes.
 * Convenience wrapper around useRequireRole.
 */
export function useRequireAdminOrModerator() {
  return useRequireRole('admin', 'moderator');
}

export default useRequireRole;
