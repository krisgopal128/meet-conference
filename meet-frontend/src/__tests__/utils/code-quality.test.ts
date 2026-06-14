import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../../store/roomStore';
import type { ChatMessage } from '../../types';
import type { LiveKitRole, DbUserRole } from '../../types/roles';

describe('Code Quality: Duplicate Code and Inconsistent Naming', () => {
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
      messages: [],
      unreadCount: 0,
    });
    localStorage.clear();
  });

  describe('role constants', () => {
    it('should have consistent role definitions across the system', () => {
      const expectedLiveKitRoles: LiveKitRole[] = ['host', 'cohost', 'presenter', 'attendee', 'viewer'];
      const expectedDbRoles: DbUserRole[] = ['admin', 'moderator', 'participant'];
      const allRoles = [...expectedLiveKitRoles, ...expectedDbRoles];

      expect(new Set(allRoles).size).toBe(allRoles.length);

      const requiredRoles = ['host', 'moderator', 'cohost', 'attendee', 'presenter', 'viewer'];
      for (const role of requiredRoles) {
        expect(allRoles).toContain(role);
      }

      const { setRole } = useRoomStore.getState();
      for (const role of expectedLiveKitRoles) {
        setRole(role);
        expect(useRoomStore.getState().role).toBe(role);
      }
    });
  });

  describe('store action naming convention', () => {
    it('should follow verb-based naming for all actions', () => {
      const validPrefixes = [
        'set', 'toggle', 'add', 'remove', 'reset', 'clear',
        'raise', 'lower', 'open', 'increment', 'decrement',
        'vote', 'close', 'merge', 'has',
      ];

      const state = useRoomStore.getState();
      const actionNames = Object.entries(state)
        .filter(([, value]) => typeof value === 'function')
        .map(([key]) => key);

      expect(actionNames.length).toBeGreaterThan(0);

      for (const action of actionNames) {
        const matchesPrefix = validPrefixes.some(prefix => action.startsWith(prefix));
        expect(matchesPrefix).toBe(true);
      }
    });
  });

  describe('no duplicate state fields', () => {
    it('should not have semantically duplicate state fields', () => {
      const stateKeys = Object.keys(useRoomStore.getState());

      expect(stateKeys).toContain('chatOpen');
      expect(stateKeys).not.toContain('isChatOpen');

      expect(stateKeys).toContain('participantsOpen');
      expect(stateKeys).not.toContain('isParticipantsOpen');

      expect(stateKeys).toContain('settingsOpen');
      expect(stateKeys).not.toContain('isSettingsOpen');

      expect(stateKeys).toContain('isConnected');
      expect(stateKeys).not.toContain('connected');
    });
  });

  describe('persisted state keys', () => {
    it('should only persist UI preferences, not connection state', () => {
      const { setToken, setConnected, setConnecting } = useRoomStore.getState();
      setToken('secret-token', 'user-1', 'host');
      setConnected(true);
      setConnecting(true);

      const persisted = localStorage.getItem('meet-ui-preferences');
      expect(persisted).not.toBeNull();

      const parsed = JSON.parse(persisted as string);
      const persistedState = parsed.state ?? parsed;

      expect(persistedState).not.toHaveProperty('token');
      expect(persistedState).not.toHaveProperty('isConnected');
      expect(persistedState).not.toHaveProperty('isConnecting');

      expect(persistedState).toHaveProperty('layout');
      expect(persistedState).toHaveProperty('mirrorLocalVideo');
    });
  });

  describe('message type union', () => {
    it('should have exhaustive message type definitions', () => {
      const validTypes: ChatMessage['type'][] = ['chat', 'system', 'reaction', 'private_chat', 'poll'];

      expect(new Set(validTypes).size).toBe(validTypes.length);

      expect(validTypes).toContain('chat');
      expect(validTypes).toContain('system');

      for (const type of validTypes) {
        const msg: ChatMessage = {
          id: `test-${type}`,
          senderIdentity: 'user-1',
          senderName: 'Test',
          message: 'content',
          sentAt: new Date(),
          type,
        };
        expect(msg.type).toBe(type);
      }
    });
  });
});
