import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types';

describe('authStore', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'participant',
  };

  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      initialized: true,
    });
    localStorage.clear();
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

  describe('in-memory auth state', () => {
    it('should keep token in store state only', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'session-token');
      
      const state = useAuthStore.getState();
      expect(state.token).toBe('session-token');
    });

    it('should keep user in store state', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
    });

    it('should mark store initialized after login', () => {
      const { login } = useAuthStore.getState();
      login(mockUser, 'test-token');
      
      expect(useAuthStore.getState().initialized).toBe(true);
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
        role: 'participant',
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

    it('should expose initialized state', () => {
      const state = useAuthStore.getState();
      expect(state.initialized).toBe(true);
    });
  });
});
