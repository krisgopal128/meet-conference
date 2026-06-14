import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import type { User } from '../../types';

describe('Architecture: Store Design', () => {
  const mockUser: User = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'participant',
  };

  beforeEach(() => {
    useRoomStore.setState({
      roomName: null,
      token: null,
      identity: null,
      role: null,
      hostId: null,
      isConnecting: false,
      isConnected: false,
      error: null,
      layout: 'speaker',
      chatOpen: false,
      participantsOpen: false,
      settingsOpen: false,
      settingsView: 'devices',
      lobbyCount: 0,
      joinLeaveSoundsEnabled: true,
      mirrorLocalVideo: true,
      showChatTimestamps: false,
      qualityMode: 'auto',
      selectedQualityMode: 'auto',
      screenShareMode: 'documents',
      qualityOverrideReason: null,
      autoFallbackActive: false,
      connectionQualityLabel: 'unknown',
      packetLossPercent: null,
      rttMs: null,
      jitterMs: null,
      availableBitrateKbps: null,
      batteryLevelPercent: null,
      batteryCharging: null,
      diagnosticsLog: [],
      messages: [],
      unreadCount: 0,
      typingParticipants: {},
      raisedHands: [],
      isRecording: false,
      egressId: null,
      pinnedIdentity: null,
    });
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      initialized: true,
    });
    localStorage.clear();
  });

  describe('resetConnection', () => {
    it('should clear ALL connection state', () => {
      const { setRoom, setToken, setHostId, setConnecting, setConnected, setError, resetConnection } =
        useRoomStore.getState();

      setRoom('test-room');
      setToken('tok', 'id1', 'host');
      setHostId('host-1');
      setConnecting(true);
      setConnected(true);
      setError('some error');

      resetConnection();

      const state = useRoomStore.getState();
      expect(state.roomName).toBe(null);
      expect(state.token).toBe(null);
      expect(state.identity).toBe(null);
      expect(state.role).toBe(null);
      expect(state.hostId).toBe(null);
      expect(state.isConnecting).toBe(false);
      expect(state.isConnected).toBe(false);
      expect(state.error).toBe(null);
    });
  });

  describe('authStore logout', () => {
    it('should clear all sensitive data', () => {
      const { login, logout } = useAuthStore.getState();
      login(mockUser, 'secret-token');
      expect(useAuthStore.getState().token).toBe('secret-token');

      logout();

      const state = useAuthStore.getState();
      expect(state.token).toBe(null);
      expect(state.user).toBe(null);
      expect(state.isAuthenticated).toBe(false);

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key as string);
        expect(value).not.toContain('secret-token');
      }
    });
  });

  describe('setToken atomicity', () => {
    it('should store token, identity, and role in a single state update', () => {
      const listener = vi.fn();
      const unsubscribe = useRoomStore.subscribe(listener);

      useRoomStore.getState().setToken('tok', 'id1', 'host');

      expect(listener).toHaveBeenCalledTimes(1);

      const newState = listener.mock.calls[0][0];
      expect(newState.token).toBe('tok');
      expect(newState.identity).toBe('id1');
      expect(newState.role).toBe('host');

      const state = useRoomStore.getState();
      expect(state.token).toBe('tok');
      expect(state.identity).toBe('id1');
      expect(state.role).toBe('host');

      unsubscribe();
    });
  });

  describe('action idempotency', () => {
    it('should be idempotent for repeated calls', () => {
      const { setLayout, setError } = useRoomStore.getState();

      setLayout('grid');
      setLayout('grid');
      expect(useRoomStore.getState().layout).toBe('grid');

      setError(null);
      expect(() => setError(null)).not.toThrow();
      expect(useRoomStore.getState().error).toBe(null);
    });
  });

  describe('addMessage with invalid data', () => {
    it('should not corrupt state when given invalid input', () => {
      const { addMessage } = useRoomStore.getState();

      expect(() => addMessage(null as unknown as Parameters<typeof addMessage>[0])).toThrow();

      const state = useRoomStore.getState();
      expect(state.messages).toHaveLength(0);
      expect(state.messages.every((m) => m != null && m.id !== undefined)).toBe(true);
      expect(Number.isFinite(state.unreadCount)).toBe(true);
      expect(Number.isNaN(state.unreadCount)).toBe(false);
    });
  });
});
