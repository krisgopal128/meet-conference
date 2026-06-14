import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
import type { ChatMessage, LayoutMode } from '../types';
import { meetingRoomConfig, type QualityModeName, type ScreenShareModeName } from '../config/meetingRoomConfig';

const DEVTOOLS_ENABLED = import.meta.env.DEV && import.meta.env.MODE !== 'test';

function safeGetTime(date: Date | string): number {
  return date instanceof Date ? date.getTime() : new Date(date).getTime();
}

export type BackgroundMode = 'blur' | 'image' | 'color' | 'none';

export type SettingsView = 'devices' | 'call-health' | 'video-effects';
export type QualityOverrideReason = 'network' | 'cpu' | 'battery' | null;
export type GridAspectRatio = '16:9' | '9:16' | '1:1' | '4:3';
export type VideoFitMode = 'cover' | 'contain';

// ============================================
// SLICE 1: Connection State
// ============================================
interface ConnectionState {
  roomName: string | null;
  token: string | null;
  identity: string | null;
  role: string | null;
  hostId: string | null;
  displayName: string | null; // Fallback name before LiveKit connection
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  isPiPOpen: boolean;
  prejoinCameraId: string | null;
  prejoinMicId: string | null;
}

interface ConnectionActions {
  setRoom: (roomName: string) => void;
  setToken: (token: string, identity: string, role: string) => void;
  setHostId: (hostId: string | null) => void;
  setRole: (role: string) => void;
  setDisplayName: (displayName: string | null) => void;
  setConnecting: (isConnecting: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setError: (error: string | null) => void;
  resetConnection: () => void;
  setPiPOpen: (open: boolean) => void;
  togglePiP: () => void;
  setPrejoinDevices: (cameraId: string | null, micId: string | null) => void;
}

const initialConnectionState: ConnectionState = {
  roomName: null,
  token: null,
  identity: null,
  role: null,
  hostId: null,
  displayName: null,
  isConnecting: false,
  isConnected: false,
  error: null,
  isPiPOpen: false,
  prejoinCameraId: null,
  prejoinMicId: null,
};

// ============================================
// SLICE 2: UI State
// ============================================
interface UIState {
  layout: LayoutMode;
  chatOpen: boolean;
  participantsOpen: boolean;
  settingsOpen: boolean;
  whiteboardOpen: boolean;
  whiteboardFullscreen: boolean;
  /** Remembers the layout mode before whiteboard was opened */
  _prevLayout?: LayoutMode;
  settingsView: SettingsView;
  lobbyCount: number;
  joinLeaveSoundsEnabled: boolean;
  mirrorLocalVideo: boolean;
  showChatTimestamps: boolean;
  qualityMode: QualityModeName;
  selectedQualityMode: QualityModeName;
  screenShareMode: ScreenShareModeName;
  qualityOverrideReason: QualityOverrideReason;
  autoFallbackActive: boolean;
  connectionQualityLabel: string;
  packetLossPercent: number | null;
  rttMs: number | null;
  jitterMs: number | null;
  availableBitrateKbps: number | null;
  batteryLevelPercent: number | null;
  batteryCharging: boolean | null;
  gridAspectRatio: GridAspectRatio;
  videoFitMode: VideoFitMode;
  backgroundBlurEnabled: boolean;
  backgroundBlurLevel: number;
  backgroundMode: BackgroundMode;
  backgroundBlurIntensity: number;
  backgroundFeather: number;
  backgroundBgColor: string;
  backgroundImagePath: string | null;
  diagnosticsLog: Array<{
    id: string;
    at: string;
    type: 'network' | 'cpu' | 'battery' | 'recovery' | 'manual';
    message: string;
  }>;
}

interface UIActions {
  setLayout: (layout: LayoutMode) => void;
  toggleChat: () => void;
  toggleParticipants: () => void;
  toggleSettings: () => void;
  toggleWhiteboard: () => void;
  toggleWhiteboardFullscreen: () => void;
  setWhiteboardFullscreen: (fullscreen: boolean) => void;
  openSettingsView: (view: SettingsView) => void;
  setLobbyCount: (count: number) => void;
  incrementLobbyCount: () => void;
  decrementLobbyCount: () => void;
  toggleJoinLeaveSounds: () => void;
  toggleMirrorLocalVideo: () => void;
  toggleChatTimestamps: () => void;
  setQualityMode: (mode: QualityModeName) => void;
  setScreenShareMode: (mode: ScreenShareModeName) => void;
  setQualityOverride: (mode: QualityModeName | null, reason?: QualityOverrideReason) => void;
  setConnectionQualityLabel: (label: string) => void;
  setCallMetrics: (metrics: Partial<Pick<UIState, 'packetLossPercent' | 'rttMs' | 'jitterMs' | 'availableBitrateKbps' | 'batteryLevelPercent' | 'batteryCharging'>>) => void;
  setGridAspectRatio: (ratio: GridAspectRatio) => void;
  setVideoFitMode: (mode: VideoFitMode) => void;
  setBackgroundBlurEnabled: (enabled: boolean) => void;
  setBackgroundBlurLevel: (level: number) => void;
  setBackgroundMode: (mode: BackgroundMode) => void;
  setBackgroundBlurIntensity: (intensity: number) => void;
  setBackgroundFeather: (feather: number) => void;
  setBackgroundBgColor: (color: string) => void;
  setBackgroundImagePath: (path: string | null) => void;
  toggleBackgroundBlur: () => void;
  addDiagnosticsEvent: (event: Omit<UIState['diagnosticsLog'][number], 'id' | 'at'>) => void;
  clearDiagnosticsLog: () => void;
  resetUI: () => void;
}

const initialUIState: UIState = {
  layout: meetingRoomConfig.room.defaultLayout,
  chatOpen: false,
  participantsOpen: false,
  settingsOpen: false,
  whiteboardOpen: false,
  whiteboardFullscreen: false,
  settingsView: 'devices',
  lobbyCount: 0,
  joinLeaveSoundsEnabled: meetingRoomConfig.room.joinLeaveSoundsEnabled,
  mirrorLocalVideo: meetingRoomConfig.room.mirrorLocalVideo,
  showChatTimestamps: meetingRoomConfig.room.showChatTimestamps,
  qualityMode: meetingRoomConfig.qualityModes.defaultMode,
  selectedQualityMode: meetingRoomConfig.qualityModes.defaultMode,
  screenShareMode: meetingRoomConfig.media.screenShare.defaultMode,
  qualityOverrideReason: null,
  autoFallbackActive: false,
  connectionQualityLabel: 'unknown',
    packetLossPercent: null,
    rttMs: null,
    jitterMs: null,
    availableBitrateKbps: null,
    batteryLevelPercent: null,
    batteryCharging: null,
  gridAspectRatio: '16:9',
  videoFitMode: 'cover',
  backgroundBlurEnabled: false,
  backgroundBlurLevel: 10,
  backgroundMode: 'blur' as BackgroundMode,
  backgroundBlurIntensity: 14,
  backgroundFeather: 3,
  backgroundBgColor: '#1e1e2e',
  backgroundImagePath: null,
  _prevLayout: undefined,
  diagnosticsLog: [],
};

// ============================================
// SLICE 3: Chat State
// ============================================
interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
  mentionCount: number;
  typingParticipants: Record<string, string>;
}

interface ChatActions {
  addMessage: (msg: ChatMessage) => void;
  mergeMessages: (messages: ChatMessage[]) => void;
  clearUnread: () => void;
  incrementMentionCount: (count?: number) => void;
  clearMentionCount: () => void;
  setTypingParticipant: (identity: string, name: string, isTyping: boolean) => void;
  resetChat: () => void;
  // Poll actions
  votePoll: (pollId: string, optionId: string, voterIdentity: string) => void;
  closePoll: (pollId: string) => void;
}

const initialChatState: ChatState = {
  messages: [],
  unreadCount: 0,
  mentionCount: 0,
  typingParticipants: {},
};

// ============================================
// SLICE 4: Room Features State
// ============================================
interface FeaturesState {
  raisedHands: string[]; // Array instead of Set for serializability
  isRecording: boolean;
  egressId: string | null;
  pinnedIdentity: string | null;
}

// ============================================
// SLICE 5: Meeting Controls State (Moderator)
// ============================================
interface MeetingControlsState {
  meetingLocked: boolean;
  lobbyEnabled: boolean;
  participantsCanShareScreen: boolean;
  participantsCanChat: boolean;
  participantsCanUnmute: boolean;
  participantsCanTurnOnCamera: boolean;
}

interface MeetingControlsActions {
  setMeetingLocked: (locked: boolean) => void;
  setLobbyEnabled: (enabled: boolean) => void;
  setParticipantsCanShareScreen: (allowed: boolean) => void;
  setParticipantsCanChat: (allowed: boolean) => void;
  setParticipantsCanUnmute: (allowed: boolean) => void;
  setParticipantsCanTurnOnCamera: (allowed: boolean) => void;
  resetMeetingControls: () => void;
}

const initialMeetingControlsState: MeetingControlsState = {
  meetingLocked: false,
  lobbyEnabled: true, // Default to enabled
  participantsCanShareScreen: true,
  participantsCanChat: true,
  participantsCanUnmute: true,
  participantsCanTurnOnCamera: true,
};

interface FeaturesActions {
  raiseHand: (identity: string) => void;
  lowerHand: (identity: string) => void;
  hasRaisedHand: (identity: string) => boolean;
  setRecording: (isRecording: boolean, egressId?: string) => void;
  setPinned: (identity: string | null) => void;
  resetFeatures: () => void;
}

const initialFeaturesState: FeaturesState = {
  raisedHands: [],
  isRecording: false,
  egressId: null,
  pinnedIdentity: null,
};

// ============================================
// COMBINED STORE TYPE
// ============================================
type RoomStoreState = ConnectionState & UIState & ChatState & FeaturesState & MeetingControlsState;
type RoomStoreActions = ConnectionActions & UIActions & ChatActions & FeaturesActions & MeetingControlsActions;
type RoomStore = RoomStoreState & RoomStoreActions & { reset: () => void };

function getPersistedLayoutPreference(layout: LayoutMode): LayoutMode {
  return layout === 'whiteboard' || layout === 'screenshare'
    ? meetingRoomConfig.room.defaultLayout
    : layout;
}

// ============================================
// OPTIMIZED STORE (NO IMMER - using spread operators)
// ============================================

// Helper function to update a message at a specific index
function updateMessageAtIndex(
  messages: ChatMessage[],
  pollIndex: number,
  updater: (msg: ChatMessage) => ChatMessage
): ChatMessage[] {
  const updatedMessage = updater(messages[pollIndex]);
  return [
    ...messages.slice(0, pollIndex),
    updatedMessage,
    ...messages.slice(pollIndex + 1),
  ];
}

export const useRoomStore = create<RoomStore>()(
  devtools(
    persist(
      subscribeWithSelector((set, get) => ({
          // Connection slice
          ...initialConnectionState,
          setRoom: (roomName) => set({ roomName }, false, 'setRoom'),
          setToken: (token, identity, role) => set({ token, identity, role }, false, 'setToken'),
          setHostId: (hostId) => set({ hostId }, false, 'setHostId'),
          setRole: (role) => set({ role }, false, 'setRole'),
          setDisplayName: (displayName) => set({ displayName }, false, 'setDisplayName'),
          setConnecting: (isConnecting) => set({ isConnecting }, false, 'setConnecting'),
          setConnected: (isConnected) => set({ isConnected }, false, 'setConnected'),
          setError: (error) => set({ error }, false, 'setError'),
          resetConnection: () => set(initialConnectionState, false, 'resetConnection'),
          setPiPOpen: (isPiPOpen) => set({ isPiPOpen }, false, 'setPiPOpen'),
          togglePiP: () => set((state) => ({ isPiPOpen: !state.isPiPOpen }), false, 'togglePiP'),
          setPrejoinDevices: (cameraId, micId) => set({ prejoinCameraId: cameraId, prejoinMicId: micId }, false, 'setPrejoinDevices'),

          // UI slice
          ...initialUIState,
          setLayout: (layout) => set({ layout }, false, 'setLayout'),
          toggleChat: () => set((state) => ({
            chatOpen: !state.chatOpen,
            unreadCount: !state.chatOpen ? 0 : state.unreadCount,
            mentionCount: !state.chatOpen ? 0 : state.mentionCount,
          }), false, 'toggleChat'),
          toggleParticipants: () => set((state) => ({
            participantsOpen: !state.participantsOpen,
          }), false, 'toggleParticipants'),
          toggleSettings: () => set((state) => ({
            settingsOpen: !state.settingsOpen,
          }), false, 'toggleSettings'),
          toggleWhiteboard: () => set((state) => {
            const closing = state.whiteboardOpen;
            const prev = closing ? (state._prevLayout ?? 'speaker') : state.layout;
            const validPrev = prev === 'screenshare' ? 'speaker' : prev;
            return closing
              ? { whiteboardOpen: false, whiteboardFullscreen: false, layout: validPrev as LayoutMode, _prevLayout: undefined }
              : { whiteboardOpen: true, layout: 'whiteboard' as LayoutMode, _prevLayout: state.layout };
          }, false, 'toggleWhiteboard'),
          toggleWhiteboardFullscreen: () => set((state) => ({
            whiteboardFullscreen: !state.whiteboardFullscreen,
          }), false, 'toggleWhiteboardFullscreen'),
          setWhiteboardFullscreen: (whiteboardFullscreen) => set({ whiteboardFullscreen }, false, 'setWhiteboardFullscreen'),
          openSettingsView: (settingsView) => set({ settingsOpen: true, settingsView }, false, 'openSettingsView'),
          setLobbyCount: (lobbyCount) => set({ lobbyCount }, false, 'setLobbyCount'),
          incrementLobbyCount: () => set((state) => ({
            lobbyCount: state.lobbyCount + 1,
          }), false, 'incrementLobbyCount'),
          decrementLobbyCount: () => set((state) => ({
            lobbyCount: Math.max(0, state.lobbyCount - 1),
          }), false, 'decrementLobbyCount'),
          toggleJoinLeaveSounds: () => set((state) => ({
            joinLeaveSoundsEnabled: !state.joinLeaveSoundsEnabled,
          }), false, 'toggleJoinLeaveSounds'),
          toggleMirrorLocalVideo: () => set((state) => ({
            mirrorLocalVideo: !state.mirrorLocalVideo,
          }), false, 'toggleMirrorLocalVideo'),
          toggleChatTimestamps: () => set((state) => ({
            showChatTimestamps: !state.showChatTimestamps,
          }), false, 'toggleChatTimestamps'),
          // Sets the user's preferred quality mode. The effective qualityMode
          // is only updated if no auto-fallback is active.
          setQualityMode: (selectedQualityMode) => set((state) => ({
            selectedQualityMode,
            qualityMode: state.autoFallbackActive ? state.qualityMode : selectedQualityMode,
          }), false, 'setQualityMode'),
          setScreenShareMode: (screenShareMode) => set({ screenShareMode }, false, 'setScreenShareMode'),
          setQualityOverride: (qualityMode, qualityOverrideReason = null) => set((state) => {
            if (qualityMode) {
              return {
                qualityMode,
                qualityOverrideReason,
                autoFallbackActive: true,
              };
            }
            return {
              qualityMode: state.selectedQualityMode,
              qualityOverrideReason: null,
              autoFallbackActive: false,
            };
          }, false, 'setQualityOverride'),
          setConnectionQualityLabel: (connectionQualityLabel) => set({ connectionQualityLabel }, false, 'setConnectionQualityLabel'),
          setCallMetrics: (metrics) => set(metrics, false, 'setCallMetrics'),
          setGridAspectRatio: (gridAspectRatio) => set({ gridAspectRatio }, false, 'setGridAspectRatio'),
          setVideoFitMode: (videoFitMode) => set({ videoFitMode }, false, 'setVideoFitMode'),
          setBackgroundBlurEnabled: (backgroundBlurEnabled) => set({ backgroundBlurEnabled }, false, 'setBackgroundBlurEnabled'),
          setBackgroundBlurLevel: (backgroundBlurLevel) => set({ backgroundBlurLevel }, false, 'setBackgroundBlurLevel'),
          setBackgroundMode: (backgroundMode) => set({ backgroundMode }, false, 'setBackgroundMode'),
          setBackgroundBlurIntensity: (backgroundBlurIntensity) => set({ backgroundBlurIntensity }, false, 'setBackgroundBlurIntensity'),
          setBackgroundFeather: (backgroundFeather) => set({ backgroundFeather }, false, 'setBackgroundFeather'),
          setBackgroundBgColor: (backgroundBgColor) => set({ backgroundBgColor }, false, 'setBackgroundBgColor'),
          setBackgroundImagePath: (backgroundImagePath) => set({ backgroundImagePath }, false, 'setBackgroundImagePath'),
          toggleBackgroundBlur: () => set((state) => ({
            backgroundBlurEnabled: !state.backgroundBlurEnabled,
          }), false, 'toggleBackgroundBlur'),
          addDiagnosticsEvent: (event) => set((state) => ({
            diagnosticsLog: [
              {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                at: new Date().toISOString(),
                ...event,
              },
              ...state.diagnosticsLog,
            ].slice(0, 20),
          }), false, 'addDiagnosticsEvent'),
          clearDiagnosticsLog: () => set({ diagnosticsLog: [] }, false, 'clearDiagnosticsLog'),
          resetUI: () => set(initialUIState, false, 'resetUI'),

          // Chat slice
          ...initialChatState,
          addMessage: (msg) => set((state) => {
            // Check for duplicates
            if (state.messages.some((m) => m.id === msg.id)) {
              return {};
            }
            // Insert in sorted order (binary search) instead of full sort - O(n) vs O(n log n)
            const messages = [...state.messages];
            const msgTime = safeGetTime(msg.sentAt);
            let insertIdx = messages.length;
            for (let i = messages.length - 1; i >= 0; i--) {
              if (safeGetTime(messages[i].sentAt) <= msgTime) {
                insertIdx = i + 1;
                break;
              }
              if (i === 0) insertIdx = 0;
            }
            messages.splice(insertIdx, 0, msg);
            
            // Prune old messages to prevent unbounded growth (keep last 500)
            const MAX_MESSAGES = 500;
            if (messages.length > MAX_MESSAGES) {
              messages.splice(0, messages.length - MAX_MESSAGES);
            }
            
            return {
              messages,
              unreadCount: state.chatOpen ? state.unreadCount : state.unreadCount + 1,
            };
          }, false, 'addMessage'),
          mergeMessages: (messages) => set((state) => {
            const existingIds = new Set(state.messages.map((m) => m.id));
            const newMessages = messages.filter((m) => !existingIds.has(m.id));
            
            if (newMessages.length === 0) return {};
            
            const allMessages = [...state.messages, ...newMessages].sort(
              (a, b) => safeGetTime(a.sentAt) - safeGetTime(b.sentAt)
            );
            
            // Prune old messages to prevent unbounded growth
            const MAX_MESSAGES = 500;
            if (allMessages.length > MAX_MESSAGES) {
              allMessages.splice(0, allMessages.length - MAX_MESSAGES);
            }
            
            return {
              messages: allMessages,
              unreadCount: state.chatOpen ? state.unreadCount : state.unreadCount + newMessages.length,
            };
          }, false, 'mergeMessages'),
          clearUnread: () => set({ unreadCount: 0 }, false, 'clearUnread'),
          incrementMentionCount: (count = 1) => set((state) => ({
            mentionCount: state.mentionCount + count,
          }), false, 'incrementMentionCount'),
          clearMentionCount: () => set({ mentionCount: 0 }, false, 'clearMentionCount'),
          setTypingParticipant: (identity, name, isTyping) => set((state) => {
            if (isTyping) {
              return {
                typingParticipants: { ...state.typingParticipants, [identity]: name },
              };
            }
            // Remove identity from typing participants
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { [identity]: _, ...rest } = state.typingParticipants;
            return { typingParticipants: rest };
          }, false, 'setTypingParticipant'),
          resetChat: () => set(initialChatState, false, 'resetChat'),
          // Poll actions
          votePoll: (pollId, optionId, voterIdentity) => set((state) => {
            const pollIndex = state.messages.findIndex(m => m.type === 'poll' && m.poll?.id === pollId);
            if (pollIndex === -1) return {};
            
            const pollMessage = state.messages[pollIndex];
            if (!pollMessage.poll || pollMessage.poll.isClosed) return {};
            
            const poll = pollMessage.poll;
            const option = poll.options.find(o => o.id === optionId);
            if (!option) return {};
            
            // Update options
            let updatedOptions = poll.options.map(o => ({
              ...o,
              votes: !poll.allowMultiple
                ? o.votes.filter(v => v !== voterIdentity)
                : o.votes,
            }));
            
            // Add vote to selected option (toggle off if already voted)
            updatedOptions = updatedOptions.map(o =>
              o.id === optionId
                ? {
                    ...o,
                    votes: o.votes.includes(voterIdentity)
                      ? o.votes.filter(v => v !== voterIdentity)
                      : [...o.votes, voterIdentity],
                  }
                : o
            );
            
            return {
              messages: updateMessageAtIndex(state.messages, pollIndex, (msg) => ({
                ...msg,
                poll: {
                  ...msg.poll!,
                  options: updatedOptions,
                },
              })),
            };
          }, false, 'votePoll'),
          closePoll: (pollId) => set((state) => {
            const pollIndex = state.messages.findIndex(m => m.type === 'poll' && m.poll?.id === pollId);
            if (pollIndex === -1) return {};
            
            const pollMessage = state.messages[pollIndex];
            if (!pollMessage.poll) return {};
            
            return {
              messages: updateMessageAtIndex(state.messages, pollIndex, (msg) => ({
                ...msg,
                poll: {
                  ...msg.poll!,
                  isClosed: true,
                },
              })),
            };
          }, false, 'closePoll'),

          // Features slice
          ...initialFeaturesState,
          raiseHand: (identity) => set((state) => ({
            raisedHands: state.raisedHands.includes(identity)
              ? state.raisedHands
              : [...state.raisedHands, identity],
          }), false, 'raiseHand'),
          lowerHand: (identity) => set((state) => ({
            raisedHands: state.raisedHands.filter((id) => id !== identity),
          }), false, 'lowerHand'),
          hasRaisedHand: (identity) => get().raisedHands.includes(identity),
          setRecording: (isRecording, egressId) => set({ isRecording, egressId: egressId ?? null }, false, 'setRecording'),
          setPinned: (pinnedIdentity) => set({ pinnedIdentity }, false, 'setPinned'),
          resetFeatures: () => set(initialFeaturesState, false, 'resetFeatures'),

          // Meeting Controls slice
          ...initialMeetingControlsState,
          setMeetingLocked: (meetingLocked) => set({ meetingLocked }, false, 'setMeetingLocked'),
          setLobbyEnabled: (lobbyEnabled) => set({ lobbyEnabled }, false, 'setLobbyEnabled'),
          setParticipantsCanShareScreen: (participantsCanShareScreen) => set({ participantsCanShareScreen }, false, 'setParticipantsCanShareScreen'),
          setParticipantsCanChat: (participantsCanChat) => set({ participantsCanChat }, false, 'setParticipantsCanChat'),
          setParticipantsCanUnmute: (participantsCanUnmute) => set({ participantsCanUnmute }, false, 'setParticipantsCanUnmute'),
          setParticipantsCanTurnOnCamera: (participantsCanTurnOnCamera) => set({ participantsCanTurnOnCamera }, false, 'setParticipantsCanTurnOnCamera'),
          resetMeetingControls: () => set(initialMeetingControlsState, false, 'resetMeetingControls'),

          // Global reset - preserves user preferences that are persisted
          reset: () => set((state) => ({
            ...initialConnectionState,
            ...initialUIState,
            // Preserve persisted user preferences
            layout: getPersistedLayoutPreference(state.layout),
            mirrorLocalVideo: state.mirrorLocalVideo,
            joinLeaveSoundsEnabled: state.joinLeaveSoundsEnabled,
            showChatTimestamps: state.showChatTimestamps,
            selectedQualityMode: state.selectedQualityMode,
            screenShareMode: state.screenShareMode,
            gridAspectRatio: state.gridAspectRatio,
            videoFitMode: state.videoFitMode,
            backgroundBlurEnabled: state.backgroundBlurEnabled,
            ...initialChatState,
            ...initialFeaturesState,
            ...initialMeetingControlsState,
          }), false, 'reset'),
        })
      ),
      {
        name: 'meet-ui-preferences',
        partialize: (state: RoomStoreState) => ({
          layout: state.layout,
          mirrorLocalVideo: state.mirrorLocalVideo,
          joinLeaveSoundsEnabled: state.joinLeaveSoundsEnabled,
          showChatTimestamps: state.showChatTimestamps,
          selectedQualityMode: state.selectedQualityMode,
          screenShareMode: state.screenShareMode,
          gridAspectRatio: state.gridAspectRatio,
          videoFitMode: state.videoFitMode,
          backgroundBlurEnabled: state.backgroundBlurEnabled,
        }),
      }
    ),
    { name: 'room-store', enabled: DEVTOOLS_ENABLED }
  )
);

// ============================================
// OPTIMIZED SELECTORS
// Use these in components to prevent unnecessary re-renders
// ============================================

// Connection selectors
export const useRoomName = () => useRoomStore((state) => state.roomName);
export const useUserIdentity = () => useRoomStore((state) => state.identity);
export const useUserRole = () => useRoomStore((state) => state.role);
export const useHostId = () => useRoomStore((state) => state.hostId);
export const useDisplayName = () => useRoomStore((state) => state.displayName);

// Check if current user is moderator
export const useIsModerator = () => useRoomStore((state) => {
  const { role, identity, hostId } = state;
  // Only check identity === hostId if both are non-null/non-empty
  // Otherwise null === null would incorrectly return true
  const isHostByIdentity = !!(identity && hostId && identity === hostId);
  return role === 'host' || role === 'cohost' || role === 'moderator' || isHostByIdentity;
});

// UI selectors
export const useLayout = () => useRoomStore((state) => state.layout);
export const useChatOpen = () => useRoomStore((state) => state.chatOpen);
export const useParticipantsOpen = () => useRoomStore((state) => state.participantsOpen);
export const useSettingsOpen = () => useRoomStore((state) => state.settingsOpen);
export const useWhiteboardOpen = () => useRoomStore((state) => state.whiteboardOpen);
export const useWhiteboardFullscreen = () => useRoomStore((state) => state.whiteboardFullscreen);
export const useSettingsView = () => useRoomStore((state) => state.settingsView);
export const useLobbyCount = () => useRoomStore((state) => state.lobbyCount);
export const useJoinLeaveSoundsEnabled = () => useRoomStore((state) => state.joinLeaveSoundsEnabled);
export const useMirrorLocalVideo = () => useRoomStore((state) => state.mirrorLocalVideo);
export const useShowChatTimestamps = () => useRoomStore((state) => state.showChatTimestamps);
export const useQualityMode = () => useRoomStore((state) => state.qualityMode);
export const useSelectedQualityMode = () => useRoomStore((state) => state.selectedQualityMode);
export const useScreenShareMode = () => useRoomStore((state) => state.screenShareMode);
export const useQualityOverrideReason = () => useRoomStore((state) => state.qualityOverrideReason);
export const useAutoFallbackActive = () => useRoomStore((state) => state.autoFallbackActive);
export const useConnectionQualityLabel = () => useRoomStore((state) => state.connectionQualityLabel);
export const usePacketLossPercent = () => useRoomStore((state) => state.packetLossPercent);
export const useRttMs = () => useRoomStore((state) => state.rttMs);
export const useJitterMs = () => useRoomStore((state) => state.jitterMs);
export const useAvailableBitrateKbps = () => useRoomStore((state) => state.availableBitrateKbps);
export const useBatteryLevelPercent = () => useRoomStore((state) => state.batteryLevelPercent);
export const useBatteryCharging = () => useRoomStore((state) => state.batteryCharging);
export const useGridAspectRatio = () => useRoomStore((state) => state.gridAspectRatio);
export const useVideoFitMode = () => useRoomStore((state) => state.videoFitMode);
export const useBackgroundBlurEnabled = () => useRoomStore((state) => state.backgroundBlurEnabled);
export const useBackgroundBlurLevel = () => useRoomStore((state) => state.backgroundBlurLevel);
export const useBackgroundMode = () => useRoomStore((state) => state.backgroundMode);
export const useBackgroundBlurIntensity = () => useRoomStore((state) => state.backgroundBlurIntensity);
export const useBackgroundFeather = () => useRoomStore((state) => state.backgroundFeather);
export const useBackgroundBgColor = () => useRoomStore((state) => state.backgroundBgColor);
export const useBackgroundImagePath = () => useRoomStore((state) => state.backgroundImagePath);
export const useDiagnosticsLog = () => useRoomStore((state) => state.diagnosticsLog);

// Chat selectors
export const useMessages = () => useRoomStore((state) => state.messages);
export const useUnreadCount = () => useRoomStore((state) => state.unreadCount);
export const useMentionCount = () => useRoomStore((state) => state.mentionCount);
export const useTypingParticipants = () => useRoomStore((state) => state.typingParticipants);

// Features selectors
export const useRaisedHands = () => useRoomStore((state) => state.raisedHands);
export const useHasRaisedHand = (identity: string) =>
  useRoomStore((state) => state.raisedHands.includes(identity));
export const useIsRecording = () => useRoomStore((state) => state.isRecording);
export const useEgressId = () => useRoomStore((state) => state.egressId);
export const usePinnedIdentity = () => useRoomStore((state) => state.pinnedIdentity);

// Meeting Controls selectors
export const useMeetingLocked = () => useRoomStore((state) => state.meetingLocked);
export const useLobbyEnabled = () => useRoomStore((state) => state.lobbyEnabled);
export const useParticipantsCanShareScreen = () => useRoomStore((state) => state.participantsCanShareScreen);
export const useParticipantsCanChat = () => useRoomStore((state) => state.participantsCanChat);
export const useParticipantsCanUnmute = () => useRoomStore((state) => state.participantsCanUnmute);
export const useParticipantsCanTurnOnCamera = () => useRoomStore((state) => state.participantsCanTurnOnCamera);

// PiP selectors
export const useIsPiPOpen = () => useRoomStore((state) => state.isPiPOpen);

// ============================================
// SHALLOW COMPARISON SELECTORS
// For objects/arrays that change reference
// ============================================
import { shallow } from 'zustand/shallow';

// Get connection actions (stable reference)
export const useConnectionActions = () => useRoomStore(
  (state) => ({
    setRoom: state.setRoom,
    setToken: state.setToken,
    setHostId: state.setHostId,
    setRole: state.setRole,
    setDisplayName: state.setDisplayName,
    setConnecting: state.setConnecting,
    setConnected: state.setConnected,
    setError: state.setError,
    reset: state.reset,
    setPiPOpen: state.setPiPOpen,
    togglePiP: state.togglePiP,
    setPrejoinDevices: state.setPrejoinDevices,
  }),
  shallow
);

// Prejoin device selectors
export const usePrejoinCameraId = () => useRoomStore((state) => state.prejoinCameraId);
export const usePrejoinMicId = () => useRoomStore((state) => state.prejoinMicId);

// Get UI actions (stable reference)
export const useUIActions = () => useRoomStore(
  (state) => ({
    setLayout: state.setLayout,
    toggleChat: state.toggleChat,
    toggleParticipants: state.toggleParticipants,
    toggleSettings: state.toggleSettings,
    toggleWhiteboard: state.toggleWhiteboard,
    toggleWhiteboardFullscreen: state.toggleWhiteboardFullscreen,
    setWhiteboardFullscreen: state.setWhiteboardFullscreen,
    openSettingsView: state.openSettingsView,
    setLobbyCount: state.setLobbyCount,
    incrementLobbyCount: state.incrementLobbyCount,
    decrementLobbyCount: state.decrementLobbyCount,
    toggleJoinLeaveSounds: state.toggleJoinLeaveSounds,
    toggleMirrorLocalVideo: state.toggleMirrorLocalVideo,
    toggleChatTimestamps: state.toggleChatTimestamps,
    setQualityMode: state.setQualityMode,
    setScreenShareMode: state.setScreenShareMode,
    setQualityOverride: state.setQualityOverride,
    setConnectionQualityLabel: state.setConnectionQualityLabel,
    setCallMetrics: state.setCallMetrics,
    setGridAspectRatio: state.setGridAspectRatio,
    setVideoFitMode: state.setVideoFitMode,
    setBackgroundBlurEnabled: state.setBackgroundBlurEnabled,
    setBackgroundBlurLevel: state.setBackgroundBlurLevel,
    setBackgroundMode: state.setBackgroundMode,
    setBackgroundBlurIntensity: state.setBackgroundBlurIntensity,
    setBackgroundFeather: state.setBackgroundFeather,
    setBackgroundBgColor: state.setBackgroundBgColor,
    setBackgroundImagePath: state.setBackgroundImagePath,
    toggleBackgroundBlur: state.toggleBackgroundBlur,
    addDiagnosticsEvent: state.addDiagnosticsEvent,
    clearDiagnosticsLog: state.clearDiagnosticsLog,
  }),
  shallow
);

// Get chat actions (stable reference)
export const useChatActions = () => useRoomStore(
  (state) => ({
    addMessage: state.addMessage,
    mergeMessages: state.mergeMessages,
    clearUnread: state.clearUnread,
    incrementMentionCount: state.incrementMentionCount,
    clearMentionCount: state.clearMentionCount,
    setTypingParticipant: state.setTypingParticipant,
    votePoll: state.votePoll,
    closePoll: state.closePoll,
  }),
  shallow
);

// Get feature actions (stable reference)
export const useFeatureActions = () => useRoomStore(
  (state) => ({
    raiseHand: state.raiseHand,
    lowerHand: state.lowerHand,
    setRecording: state.setRecording,
    setPinned: state.setPinned,
  }),
  shallow
);

// Get meeting controls actions (stable reference)
export const useMeetingControlsActions = () => useRoomStore(
  (state) => ({
    setMeetingLocked: state.setMeetingLocked,
    setLobbyEnabled: state.setLobbyEnabled,
    setParticipantsCanShareScreen: state.setParticipantsCanShareScreen,
    setParticipantsCanChat: state.setParticipantsCanChat,
    setParticipantsCanUnmute: state.setParticipantsCanUnmute,
    setParticipantsCanTurnOnCamera: state.setParticipantsCanTurnOnCamera,
    resetMeetingControls: state.resetMeetingControls,
  }),
  shallow
);

// Get PiP actions (stable reference)
export const usePiPActions = () => useRoomStore(
  (state) => ({
    setPiPOpen: state.setPiPOpen,
    togglePiP: state.togglePiP,
  }),
  shallow
);
