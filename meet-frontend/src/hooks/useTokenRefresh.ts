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
import logger from '../utils/logger';

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
      logger.info('[TokenRefresh] Token refreshed successfully');
    } catch (error) {
      logger.warn('[TokenRefresh] Failed to refresh token:', error);
      // Don't logout on refresh failure - the response interceptor will handle it
      // by trying refresh again on 401 before giving up
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

    logger.info(`[TokenRefresh] Token refresh scheduled in ${Math.round(refreshIn / 1000 / 60)} minutes`);

    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [token, refreshToken]);

  const refreshTokenRef = useRef(refreshToken);
  refreshTokenRef.current = refreshToken;

  // Also refresh on window focus (user returns to tab)
  useEffect(() => {
    let hiddenAt: number | null = null;

    const checkAndRefresh = () => {
      const currentToken = useAuthStore.getState().token;
      if (!currentToken) return;

      const secondsUntilExpiry = getSecondsUntilExpiry(currentToken);
      if (secondsUntilExpiry !== null && secondsUntilExpiry <= REFRESH_BUFFER_SECONDS * 2) {
        refreshTokenRef.current();
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        hiddenAt = Date.now();
      } else {
        if (hiddenAt !== null) {
          const hiddenDuration = Date.now() - hiddenAt;
          hiddenAt = null;
          if (hiddenDuration >= 2 * 60 * 1000) {
            checkAndRefresh();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
}

export default useTokenRefresh;
