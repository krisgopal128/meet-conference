import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types';

// Mock localStorage for persist middleware
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('authStore', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'participant',
  };

  beforeEach(() => {
    // Reset store to initial state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    });
    localStorageMock.clear();
  });

  describe('login action', () => {
    it('should set user and token on login', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe('test-token');
      expect(state.isAuthenticated).toBe(true);
    });

    it('should update isAuthenticated to true on login', () => {
      const { login } = useAuthStore.getState();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      
      login(mockUser, 'test-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('should store user with all properties', () => {
      const { login } = useAuthStore.getState();
      const fullUser: User = {
        id: 'user-456',
        email: 'john@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'admin',
      };
      
      login(fullUser, 'admin-token');
      
      const state = useAuthStore.getState();
      expect(state.user).toMatchObject({
        id: 'user-456',
        email: 'john@example.com',
        name: 'John Doe',
        avatarUrl: 'https://example.com/avatar.jpg',
        role: 'admin',
      });
    });

    it('should replace existing user on subsequent login', () => {
      const { login } = useAuthStore.getState();
      
      login(mockUser, 'first-token');
      const firstState = useAuthStore.getState();
      expect(firstState.user?.id).toBe('user-123');
      
      const secondUser: User = {
        id: 'user-789',
        email: 'other@example.com',
        name: 'Other User',
        role: 'participant',
      };
      login(secondUser, 'second-token');
      
      const secondState = useAuthStore.getState();
      expect(secondState.user?.id).toBe('user-789');
      expect(secondState.token).toBe('second-token');
    });
  });

  describe('logout action', () => {
    it('should clear user and token on logout', () => {
      const { login, logout } = useAuthStore.getState();
      
      login(mockUser, 'test-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      
      logout();
      
      const state = useAuthStore.getState();
      expect(state.user).toBe(null);
      expect(state.token).toBe(null);
      expect(state.isAuthenticated).toBe(false);
    });

    it('should set isAuthenticated to false on logout', () => {
      const { login, logout } = useAuthStore.getState();
      
      login(mockUser, 'test-token');
      logout();
      
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('should work when logging out without being logged in', () => {
      const { logout } = useAuthStore.getState();
      
      // Should not throw
      expect(() => logout()).not.toThrow();
      
      const state = useAuthStore.getState();
      expect(state.user).toBe(null);
      expect(state.token).toBe(null);
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('token persistence', () => {
    it('should have token in persisted state', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'persisted-token');
      
      const state = useAuthStore.getState();
      const partialState = {
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      };
      
      expect(partialState.token).toBe('persisted-token');
    });

    it('should have user in persisted state', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      const state = useAuthStore.getState();
      const partialState = {
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      };
      
      expect(partialState.user).toEqual(mockUser);
    });

    it('should have isAuthenticated in persisted state', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      const state = useAuthStore.getState();
      const partialState = {
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      };
      
      expect(partialState.isAuthenticated).toBe(true);
    });
  });

  describe('updateUser action', () => {
    it('should update user name', () => {
      const { login, updateUser } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      updateUser({ name: 'Updated Name' });
      
      const state = useAuthStore.getState();
      expect(state.user?.name).toBe('Updated Name');
      expect(state.user?.email).toBe('test@example.com'); // Other fields preserved
    });

    it('should update user avatarUrl', () => {
      const { login, updateUser } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      updateUser({ avatarUrl: 'https://example.com/new-avatar.jpg' });
      
      const state = useAuthStore.getState();
      expect(state.user?.avatarUrl).toBe('https://example.com/new-avatar.jpg');
    });

    it('should not modify user when not logged in', () => {
      const { updateUser } = useAuthStore.getState();
      
      updateUser({ name: 'Should Not Update' });
      
      const state = useAuthStore.getState();
      expect(state.user).toBe(null);
    });

    it('should preserve other user properties on update', () => {
      const { login, updateUser } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      updateUser({ name: 'New Name' });
      
      const state = useAuthStore.getState();
      expect(state.user).toMatchObject({
        id: 'user-123',
        email: 'test@example.com',
        name: 'New Name',
        role: 'user',
      });
    });
  });

  describe('selectors', () => {
    it('useUser should return user', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      const user = useAuthStore.getState().user;
      expect(user).toEqual(mockUser);
    });

    it('useToken should return token', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'selector-token');
      
      const token = useAuthStore.getState().token;
      expect(token).toBe('selector-token');
    });

    it('useIsAuthenticated should return authentication status', () => {
      const { login, logout } = useAuthStore.getState();
      
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      
      login(mockUser, 'test-token');
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      
      logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('initial state', () => {
    it('should have null user initially', () => {
      const state = useAuthStore.getState();
      expect(state.user).toBe(null);
    });

    it('should have null token initially', () => {
      const state = useAuthStore.getState();
      expect(state.token).toBe(null);
    });

    it('should have isAuthenticated false initially', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });
});
