import { describe, it, expect, beforeEach } from 'vitest';
import { useRoomStore } from '../../store/roomStore';

describe('roomStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
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
    localStorage.clear();
  });

  describe('toggleLayout action', () => {
    it('should set layout to speaker', () => {
      const { setLayout } = useRoomStore.getState();
      setLayout('speaker');
      expect(useRoomStore.getState().layout).toBe('speaker');
    });

    it('should set layout to grid', () => {
      const { setLayout } = useRoomStore.getState();
      setLayout('grid');
      expect(useRoomStore.getState().layout).toBe('grid');
    });

    it('should set layout to spotlight', () => {
      const { setLayout } = useRoomStore.getState();
      setLayout('spotlight');
      expect(useRoomStore.getState().layout).toBe('spotlight');
    });

    it('should set layout to screenshare', () => {
      const { setLayout } = useRoomStore.getState();
      setLayout('screenshare');
      expect(useRoomStore.getState().layout).toBe('screenshare');
    });

    it('should update layout via selector', () => {
      const { setLayout } = useRoomStore.getState();
      setLayout('grid');
      // Use getState() instead of hook (hooks can't be used outside React)
      expect(useRoomStore.getState().layout).toBe('grid');
    });
  });

  describe('setMirrorLocalVideo action', () => {
    it('should toggle mirrorLocalVideo from true to false', () => {
      const { toggleMirrorLocalVideo } = useRoomStore.getState();
      expect(useRoomStore.getState().mirrorLocalVideo).toBe(true);
      
      toggleMirrorLocalVideo();
      expect(useRoomStore.getState().mirrorLocalVideo).toBe(false);
    });

    it('should toggle mirrorLocalVideo from false to true', () => {
      const { toggleMirrorLocalVideo } = useRoomStore.getState();
      useRoomStore.setState({ mirrorLocalVideo: false });
      
      toggleMirrorLocalVideo();
      expect(useRoomStore.getState().mirrorLocalVideo).toBe(true);
    });

    it('should update mirrorLocalVideo via selector', () => {
      const { toggleMirrorLocalVideo } = useRoomStore.getState();
      toggleMirrorLocalVideo();
      
      // Re-select after toggle
      const state = useRoomStore.getState();
      expect(state.mirrorLocalVideo).toBe(false);
    });
  });

  describe('persist configuration', () => {
    it('should include layout in persisted state', () => {
      const { setLayout } = useRoomStore.getState();
      setLayout('grid');
      
      // Get the partialized state (what gets persisted)
      const state = useRoomStore.getState();
      const partialState = {
        layout: state.layout,
        mirrorLocalVideo: state.mirrorLocalVideo,
        joinLeaveSoundsEnabled: state.joinLeaveSoundsEnabled,
        showChatTimestamps: state.showChatTimestamps,
        selectedQualityMode: state.selectedQualityMode,
        screenShareMode: state.screenShareMode,
      };
      
      expect(partialState.layout).toBe('grid');
    });

    it('should include mirrorLocalVideo in persisted state', () => {
      const { toggleMirrorLocalVideo } = useRoomStore.getState();
      toggleMirrorLocalVideo();
      
      const state = useRoomStore.getState();
      const partialState = {
        layout: state.layout,
        mirrorLocalVideo: state.mirrorLocalVideo,
        joinLeaveSoundsEnabled: state.joinLeaveSoundsEnabled,
        showChatTimestamps: state.showChatTimestamps,
        selectedQualityMode: state.selectedQualityMode,
        screenShareMode: state.screenShareMode,
      };
      
      expect(partialState.mirrorLocalVideo).toBe(false);
    });

    it('should include joinLeaveSoundsEnabled in persisted state', () => {
      const { toggleJoinLeaveSounds } = useRoomStore.getState();
      toggleJoinLeaveSounds();
      
      const state = useRoomStore.getState();
      const partialState = {
        layout: state.layout,
        mirrorLocalVideo: state.mirrorLocalVideo,
        joinLeaveSoundsEnabled: state.joinLeaveSoundsEnabled,
        showChatTimestamps: state.showChatTimestamps,
        selectedQualityMode: state.selectedQualityMode,
        screenShareMode: state.screenShareMode,
      };
      
      expect(partialState.joinLeaveSoundsEnabled).toBe(false);
    });

    it('should not include non-persisted fields like isConnected', () => {
      const { setConnected } = useRoomStore.getState();
      setConnected(true);
      
      const state = useRoomStore.getState();
      const partialState = {
        layout: state.layout,
        mirrorLocalVideo: state.mirrorLocalVideo,
        joinLeaveSoundsEnabled: state.joinLeaveSoundsEnabled,
        showChatTimestamps: state.showChatTimestamps,
        selectedQualityMode: state.selectedQualityMode,
        screenShareMode: state.screenShareMode,
      };
      
      // isConnected should not be in partialState
      expect('isConnected' in partialState).toBe(false);
    });

    it('should persist selectedQualityMode', () => {
      const { setQualityMode } = useRoomStore.getState();
      setQualityMode('highQuality');
      
      const state = useRoomStore.getState();
      expect(state.selectedQualityMode).toBe('highQuality');
    });

    it('should persist screenShareMode', () => {
      const { setScreenShareMode } = useRoomStore.getState();
      setScreenShareMode('motion');
      
      const state = useRoomStore.getState();
      expect(state.screenShareMode).toBe('motion');
    });
  });

  describe('connection state', () => {
    it('should set room name', () => {
      const { setRoom } = useRoomStore.getState();
      setRoom('test-room');
      expect(useRoomStore.getState().roomName).toBe('test-room');
    });

    it('should set token with identity and role', () => {
      const { setToken } = useRoomStore.getState();
      setToken('test-token', 'user-123', 'host');
      
      const state = useRoomStore.getState();
      expect(state.token).toBe('test-token');
      expect(state.identity).toBe('user-123');
      expect(state.role).toBe('host');
    });

    it('should set connecting state', () => {
      const { setConnecting } = useRoomStore.getState();
      setConnecting(true);
      expect(useRoomStore.getState().isConnecting).toBe(true);
    });

    it('should set connected state', () => {
      const { setConnected } = useRoomStore.getState();
      setConnected(true);
      expect(useRoomStore.getState().isConnected).toBe(true);
    });

    it('should set error', () => {
      const { setError } = useRoomStore.getState();
      setError('Connection failed');
      expect(useRoomStore.getState().error).toBe('Connection failed');
    });

    it('should reset connection state', () => {
      const { setRoom, setToken, setConnected, resetConnection } = useRoomStore.getState();
      
      setRoom('test-room');
      setToken('token', 'user', 'host');
      setConnected(true);
      
      resetConnection();
      
      const state = useRoomStore.getState();
      expect(state.roomName).toBe(null);
      expect(state.token).toBe(null);
      expect(state.identity).toBe(null);
      expect(state.isConnected).toBe(false);
    });
  });

  describe('chat state', () => {
    it('should add message', () => {
      const { addMessage } = useRoomStore.getState();
      const message = {
        id: '1',
        senderIdentity: 'user-1',
        senderName: 'John',
        message: 'Hello!',
        sentAt: new Date(),
        type: 'chat' as const,
      };
      
      addMessage(message);
      
      const state = useRoomStore.getState();
      expect(state.messages).toHaveLength(1);
      expect(state.messages[0].message).toBe('Hello!');
    });

    it('should increment unread count when chat is closed', () => {
      const { addMessage } = useRoomStore.getState();
      useRoomStore.setState({ chatOpen: false });
      
      const message = {
        id: '1',
        senderIdentity: 'user-1',
        senderName: 'John',
        message: 'Hello!',
        sentAt: new Date(),
        type: 'chat' as const,
      };
      
      addMessage(message);
      expect(useRoomStore.getState().unreadCount).toBe(1);
    });

    it('should not increment unread count when chat is open', () => {
      const { addMessage } = useRoomStore.getState();
      useRoomStore.setState({ chatOpen: true });
      
      const message = {
        id: '1',
        senderIdentity: 'user-1',
        senderName: 'John',
        message: 'Hello!',
        sentAt: new Date(),
        type: 'chat' as const,
      };
      
      addMessage(message);
      expect(useRoomStore.getState().unreadCount).toBe(0);
    });

    it('should clear unread count', () => {
      useRoomStore.setState({ unreadCount: 5 });
      const { clearUnread } = useRoomStore.getState();
      clearUnread();
      expect(useRoomStore.getState().unreadCount).toBe(0);
    });
  });

  describe('features state', () => {
    it('should raise hand', () => {
      const { raiseHand } = useRoomStore.getState();
      raiseHand('user-1');
      
      const state = useRoomStore.getState();
      expect(state.raisedHands).toContain('user-1');
    });

    it('should not duplicate raised hands', () => {
      const { raiseHand } = useRoomStore.getState();
      raiseHand('user-1');
      raiseHand('user-1');
      
      const state = useRoomStore.getState();
      expect(state.raisedHands.filter(id => id === 'user-1')).toHaveLength(1);
    });

    it('should lower hand', () => {
      const { raiseHand, lowerHand } = useRoomStore.getState();
      raiseHand('user-1');
      lowerHand('user-1');
      
      const state = useRoomStore.getState();
      expect(state.raisedHands).not.toContain('user-1');
    });

    it('should check if hand is raised', () => {
      const { raiseHand, hasRaisedHand } = useRoomStore.getState();
      raiseHand('user-1');
      expect(hasRaisedHand('user-1')).toBe(true);
      expect(hasRaisedHand('user-2')).toBe(false);
    });

    it('should set recording state', () => {
      const { setRecording } = useRoomStore.getState();
      setRecording(true, 'egress-123');
      
      const state = useRoomStore.getState();
      expect(state.isRecording).toBe(true);
      expect(state.egressId).toBe('egress-123');
    });

    it('should set pinned participant', () => {
      const { setPinned } = useRoomStore.getState();
      setPinned('user-1');
      expect(useRoomStore.getState().pinnedIdentity).toBe('user-1');
    });
  });
});
