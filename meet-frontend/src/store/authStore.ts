import { create } from 'zustand';
import { persist, devtools, createJSONStorage } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type { User } from '../types';
import { isTokenExpired } from '../utils/security';
import logger from '../utils/logger';
import { registerAuthStore } from '../services/api';

// ============================================
// AUTH STORE WITH OPTIMIZATIONS
// ============================================

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

type AuthStoreState = AuthState & AuthActions;

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        isAuthenticated: false,

        login: (user: User, token: string) => {
          if (import.meta.env.DEV) { logger.info('[AuthStore] Login called with user:', user.email); }
          set({ user, token, isAuthenticated: true }, false, 'login');
        },

        logout: () => {
          // Clear all auth-related localStorage items (defense-in-depth)
          try {
            localStorage.removeItem('auth-storage');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
          } catch {
            // Ignore storage errors
          }
          set({ user: null, token: null, isAuthenticated: false }, false, 'logout');
        },

        updateUser: (userData: Partial<User>) => {
          set(
            (state) => ({
              user: state.user ? { ...state.user, ...userData } : null,
            }),
            false,
            'updateUser'
          );
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),
        // Only persist essential fields
        partialize: (state) => ({
          user: state.user,
          token: state.token,
          isAuthenticated: state.isAuthenticated,
        }),
        // Called when storage is rehydrated
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            logger.error('Failed to rehydrate auth store:', error);
          }
          // Validate token on rehydration
          if (state?.token) {
            const expired = isTokenExpired(state.token);
            if (expired === true) {
              // Clear expired token state via scheduled update (avoids direct mutation)
              Promise.resolve().then(() => {
                useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
              });
            }
          }
        },
      }
    ),
    { name: 'auth-store', enabled: import.meta.env.DEV }
  )
);

// Register store with API interceptor so it can read the token directly
registerAuthStore(() => useAuthStore.getState());

// ============================================
// OPTIMIZED SELECTORS
// ============================================

export const useUser = () => useAuthStore((state) => state.user);
export const useIsAuthenticated = () => useAuthStore((state) => state.isAuthenticated);

// Get auth actions (stable reference)
export const useAuthActions = () => useAuthStore(
  (state) => ({
    login: state.login,
    logout: state.logout,
    updateUser: state.updateUser,
  }),
  shallow
);
