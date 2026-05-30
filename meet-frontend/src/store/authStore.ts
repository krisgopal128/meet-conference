import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import type { User } from '../types';
import logger from '../utils/logger';
import { registerAuthStore } from '../services/api';

// ============================================
// AUTH STORE WITH OPTIMIZATIONS
// ============================================

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  initialized: boolean;
}

interface AuthActions {
  login: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  setInitialized: (initialized: boolean) => void;
}

type AuthStoreState = AuthState & AuthActions;

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      initialized: false,

      login: (user: User, token: string) => {
        if (import.meta.env.DEV) { logger.info('[AuthStore] Login called with user:', user.email); }
        set({ user, token, isAuthenticated: true, initialized: true }, false, 'login');
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, initialized: true }, false, 'logout');
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

      setInitialized: (initialized: boolean) => {
        set({ initialized }, false, 'setInitialized');
      },
    }),
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
export const useAuthInitialized = () => useAuthStore((state) => state.initialized);

// Get auth actions (stable reference)
export const useAuthActions = () => useAuthStore(
  (state) => ({
    login: state.login,
    logout: state.logout,
    updateUser: state.updateUser,
    setInitialized: state.setInitialized,
  }),
  shallow
);
