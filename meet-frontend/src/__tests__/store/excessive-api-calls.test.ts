import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useRoomStore } from '../../store/roomStore';
import { useAuthStore } from '../../store/authStore';
import { isTokenExpired } from '../../utils/security';

function createJwt(expOffsetSeconds: number): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).replace(/=+$/, '');
  const payload = btoa(JSON.stringify({
    sub: 'user-1',
    exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
  })).replace(/=+$/, '');
  return `${header}.${payload}.signature`;
}

describe('Excessive API Calls prevention', () => {
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

  describe('chat typing indicator', () => {
    it('should update typing state locally without triggering network calls', () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const { addMessage, setTypingParticipant } = useRoomStore.getState();

      const message = {
        id: 'msg-1',
        senderIdentity: 'user-1',
        senderName: 'John',
        message: 'Hello!',
        sentAt: new Date(),
        type: 'chat' as const,
      };
      addMessage(message);

      for (let i = 0; i < 10; i++) {
        setTypingParticipant('user-1', 'John', true);
      }

      const state = useRoomStore.getState();
      expect(state.typingParticipants['user-1']).toBe('John');
      expect(state.messages).toHaveLength(1);
      expect(fetchSpy).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    });
  });

  describe('token refresh logic', () => {
    it('should only trigger refresh when token is near expiry', () => {
      const longToken = createJwt(3600);
      expect(isTokenExpired(longToken)).toBe(false);

      useAuthStore.setState({ token: longToken });
      expect(useAuthStore.getState().token).toBe(longToken);
      expect(isTokenExpired(useAuthStore.getState().token)).toBe(false);

      const shortToken = createJwt(10);
      expect(isTokenExpired(shortToken)).toBe(true);

      useAuthStore.setState({ token: shortToken });
      expect(isTokenExpired(useAuthStore.getState().token)).toBe(true);
    });
  });

  describe('selector specificity', () => {
    it('should not notify subscribers when unrelated state changes', () => {
      const listener = vi.fn();
      const unsubscribe = useRoomStore.subscribe(
        (state) => state.chatOpen,
        (chatOpen) => { listener(chatOpen); }
      );

      useRoomStore.getState().setConnectionQualityLabel('excellent');
      useRoomStore.getState().setConnectionQualityLabel('poor');

      expect(listener).not.toHaveBeenCalled();

      useRoomStore.getState().toggleChat();
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(true);

      unsubscribe();
    });
  });

  describe('message deduplication', () => {
    it('should deduplicate messages by ID', () => {
      const { addMessage } = useRoomStore.getState();
      const message = {
        id: 'dup-1',
        senderIdentity: 'user-1',
        senderName: 'John',
        message: 'Hello!',
        sentAt: new Date(),
        type: 'chat' as const,
      };

      addMessage(message);
      addMessage(message);

      expect(useRoomStore.getState().messages).toHaveLength(1);
    });
  });

  describe('unread count safety', () => {
    it('should keep unreadCount reasonable and finite when chat is closed', () => {
      const { addMessage } = useRoomStore.getState();
      useRoomStore.setState({ chatOpen: false });

      for (let i = 0; i < 100; i++) {
        addMessage({
          id: `msg-${i}`,
          senderIdentity: `user-${i % 5}`,
          senderName: 'User',
          message: `Message ${i}`,
          sentAt: new Date(Date.now() + i),
          type: 'chat' as const,
        });
      }

      const state = useRoomStore.getState();
      expect(state.messages).toHaveLength(100);
      expect(state.unreadCount).toBeLessThanOrEqual(state.messages.length);
      expect(Number.isFinite(state.unreadCount)).toBe(true);
      expect(Number.isNaN(state.unreadCount)).toBe(false);
    });
  });
});
