/**
 * Hook to automatically refresh authentication token before it expires.
 * 
 * This prevents users from being logged out due to token expiration
 * if they are actively using the app.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore, useAuthActions } from '../store/authStore';
import { authApi } from '../services/api';
import { getSecondsUntilExpiry } from '../utils/security';

// Refresh token 5 minutes before expiry
const REFRESH_BUFFER_SECONDS = 5 * 60;

// Minimum time before refresh (don't refresh if token was just created)
const MIN_REFRESH_INTERVAL = 60 * 1000; // 1 minute

export function useTokenRefresh() {
  const token = useAuthStore((state) => state.token);
  const { login } = useAuthActions();
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefreshRef = useRef<number>(0);

  const refreshToken = useCallback(async () => {
    // Don't refresh if no token or recently refreshed
    if (!token) return;
    
    const now = Date.now();
    if (now - lastRefreshRef.current < MIN_REFRESH_INTERVAL) {
      return;
    }

    try {
      const res = await authApi.refresh();
      login(res.data.user, res.data.token);
      lastRefreshRef.current = now;
      console.log('[TokenRefresh] Token refreshed successfully');
    } catch (error) {
      console.error('[TokenRefresh] Failed to refresh token:', error);
      // Don't logout on refresh failure - let the next API call handle it
    }
  }, [token, login]);

  useEffect(() => {
    if (!token) {
      // Clear any pending refresh
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      return;
    }

    // Calculate time until expiry
    const secondsUntilExpiry = getSecondsUntilExpiry(token);
    
    if (secondsUntilExpiry === null) {
      // Can't determine expiry, don't schedule refresh
      return;
    }

    // If token is already expired or about to expire, refresh immediately
    if (secondsUntilExpiry <= REFRESH_BUFFER_SECONDS) {
      refreshToken();
      return;
    }

    // Schedule refresh for 5 minutes before expiry
    const refreshIn = (secondsUntilExpiry - REFRESH_BUFFER_SECONDS) * 1000;
    
    // Clear any existing timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshToken();
    }, refreshIn);

    console.log(`[TokenRefresh] Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [token, refreshToken]);

  // Also refresh on window focus (user returns to tab)
  useEffect(() => {
    const handleFocus = () => {
      if (!token) return;
      
      const secondsUntilExpiry = getSecondsUntilExpiry(token);
      if (secondsUntilExpiry !== null && secondsUntilExpiry <= REFRESH_BUFFER_SECONDS * 2) {
        // Token will expire soon, refresh it
        refreshToken();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [token, refreshToken]);
}

export default useTokenRefresh;
