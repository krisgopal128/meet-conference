import { useEffect, useLayoutEffect, useRef, useState, useCallback, lazy, Suspense, memo } from 'react';
import {
  useTracks,
  useRoomContext,
  RoomAudioRenderer,
  useLocalParticipant,
} from '@livekit/components-react';
import { Track, RoomEvent, Participant, type Room } from 'livekit-client';
import { useNavigate } from 'react-router-dom';
import {
  useLayout,
  useChatOpen,
  useParticipantsOpen,
  useSettingsOpen,
  useSettingsView,
  useLobbyCount,
  useIsModerator,
  useJoinLeaveSoundsEnabled,
  useSelectedQualityMode,
  useUIActions,
} from '../../store/roomStore';
import { ControlBar } from '../controls/ControlBar';

import { SpeakerLayout } from './SpeakerLayout';
import { GridLayout } from './GridLayout';
import { ScreenShareLayout } from './ScreenShareLayout';
import { ParticipantVisibilityProvider } from '../../contexts/ParticipantVisibilityContext';
import { RoomCameraTracksProvider } from '../../contexts/RoomCameraTracksContext';
import { MobileSheet } from '../MobileSheet';
import { useDataChannelHandler } from '../../hooks/useDataChannelHandler';
import { useJoinLeaveSounds } from '../../hooks/useJoinLeaveSounds';
import { useQualityMonitoring } from '../../hooks/useQualityMonitoring';
import { useCallHealthMonitor } from '../../hooks/useCallHealthMonitor';
import { useIsMobile } from '../../hooks/useIsMobile';
import { Users, Loader2 } from 'lucide-react';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import toast from 'react-hot-toast';
import logger from '../../utils/logger';
import type { LayoutMode } from '../../types';

// Lazy load heavy panels for better initial load performance
const ChatPanel = lazy(() => import('../panels/ChatPanel').then(m => ({ default: m.ChatPanel })));
const ParticipantsPanel = lazy(() => import('../panels/ParticipantsPanel').then(m => ({ default: m.ParticipantsPanel })));
const SettingsPanel = lazy(() => import('../panels/SettingsPanel').then(m => ({ default: m.SettingsPanel })));
const WhiteboardLayout = lazy(() => import('./WhiteboardLayout').then(m => ({ default: m.WhiteboardLayout })));

function PanelLoader() {
  return (
    <div className="w-80 md:w-auto flex items-center justify-center bg-surface-800 border-l border-surface-700">
      <Loader2 className="w-6 h-6 animate-spin text-surface-400" />
    </div>
  );
}

interface ConferenceRoomProps {
  roomName?: string;
}

function ConferenceRoomInner(_props: ConferenceRoomProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const navigate = useNavigate();
  
  // Optimized selectors
  const layout = useLayout();
  const chatOpen = useChatOpen();
  const participantsOpen = useParticipantsOpen();
  const settingsOpen = useSettingsOpen();
  const lobbyCount = useLobbyCount();
  const isModerator = useIsModerator();
  const joinLeaveSoundsEnabled = useJoinLeaveSoundsEnabled();
  const selectedQualityMode = useSelectedQualityMode();
  
  // Action hooks
  const {
    setLayout,
    toggleChat,
    toggleParticipants,
    toggleSettings,
    setCallMetrics,
    setQualityOverride,
    addDiagnosticsEvent,
  } = useUIActions();
  
  const [activeSpeakers, setActiveSpeakers] = useState<Participant[]>([]);
  const screenShareTracks = useTracks([Track.Source.ScreenShare]);
  const hasActiveScreenShare = screenShareTracks.some((track) => track.publication?.isSubscribed);
  const activeSpeakerPromoteTimerRef = useRef<number | null>(null);
  const activeSpeakerDemoteTimerRef = useRef<number | null>(null);
  const layoutBeforeScreenshare = useRef<LayoutMode>('grid');
  const layoutRef = useRef(layout);
  layoutRef.current = layout;
  const previousLobbyCountRef = useRef(0);
  const hasSeenInitialLobbyCountRef = useRef(false);

  // Use extracted hooks
  const { scheduleRecovery, qualityOverrideReasonRef } = useQualityMonitoring({
    room,
    localParticipant,
    selectedQualityMode,
  });

  // Handle meeting ended - navigate to ThankYou page
  const handleMeetingEnded = useCallback((reason: string) => {
    const connectedAt = (room as Room & { connectedAt?: Date | string }).connectedAt || new Date();
    const duration = Math.round((Date.now() - new Date(connectedAt).getTime()) / 60000);
    navigate('/thank-you', { 
      state: { 
        roomName: room.name, 
        duration: duration > 0 ? duration : undefined,
        reason,
      },
      replace: true,
    });
  }, [room, navigate]);

  useDataChannelHandler({ room, localParticipant, isModerator, onMeetingEnded: handleMeetingEnded });
  useJoinLeaveSounds(room, localParticipant, joinLeaveSoundsEnabled);

  // Track active speakers - optimized for fast response
  useEffect(() => {
    const handleActiveSpeakers = (speakers: Participant[]) => {
      const nextSpeakers = speakers;

      if (nextSpeakers.length > 0) {
        // Clear demotion timer if someone starts speaking
        if (activeSpeakerDemoteTimerRef.current) {
          window.clearTimeout(activeSpeakerDemoteTimerRef.current);
          activeSpeakerDemoteTimerRef.current = null;
        }
        
        // Clear any pending promotion timer
        if (activeSpeakerPromoteTimerRef.current) {
          window.clearTimeout(activeSpeakerPromoteTimerRef.current);
          activeSpeakerPromoteTimerRef.current = null;
        }
        
        // Quick promotion for responsive switching
        activeSpeakerPromoteTimerRef.current = window.setTimeout(() => {
          setActiveSpeakers(nextSpeakers);
          activeSpeakerPromoteTimerRef.current = null;
        }, meetingRoomConfig.activeSpeaker.promotionDelayMs);
        return;
      }

      // Clear promotion timer if speakers stop
      if (activeSpeakerPromoteTimerRef.current) {
        window.clearTimeout(activeSpeakerPromoteTimerRef.current);
        activeSpeakerPromoteTimerRef.current = null;
      }
      
      // Delayed demotion to avoid flicker
      if (!activeSpeakerDemoteTimerRef.current) {
        activeSpeakerDemoteTimerRef.current = window.setTimeout(() => {
          setActiveSpeakers([]);
          activeSpeakerDemoteTimerRef.current = null;
        }, meetingRoomConfig.activeSpeaker.demotionDelayMs);
      }
    };
    room.on(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, handleActiveSpeakers);
      if (activeSpeakerPromoteTimerRef.current) {
        window.clearTimeout(activeSpeakerPromoteTimerRef.current);
      }
      if (activeSpeakerDemoteTimerRef.current) {
        window.clearTimeout(activeSpeakerDemoteTimerRef.current);
      }
    };
  }, [room]);

  // Auto-switch to screenshare layout (only reacts to hasActiveScreenShare changes)
  useEffect(() => {
    if (hasActiveScreenShare && layoutRef.current !== 'screenshare') {
      layoutBeforeScreenshare.current = layoutRef.current;
      setLayout('screenshare');
    } else if (!hasActiveScreenShare && layoutRef.current === 'screenshare') {
      setLayout(layoutBeforeScreenshare.current);
    }
  }, [hasActiveScreenShare, setLayout]);

  // Data channel, join/leave sounds, and quality monitoring are handled by extracted hooks

  // Connection quality monitoring is handled by useQualityMonitoring hook

  useEffect(() => {
    if (!isModerator) return;

    const previous = previousLobbyCountRef.current;
    if (hasSeenInitialLobbyCountRef.current && lobbyCount > previous) {
      const delta = lobbyCount - previous;
      toast((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-sm w-full bg-surface-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-surface-700 border-l-4 border-warning-500`}>
          <div className="flex-1 w-0 p-4">
            <p className="text-sm font-medium text-surface-100">
              {delta === 1 ? 'New participant waiting in lobby' : `${delta} new participants waiting in lobby`}
            </p>
            <p className="mt-1 text-sm text-surface-400">
              Open the People panel to admit or deny them.
            </p>
          </div>
        </div>
      ), { duration: 4000, position: 'top-right' });
    }

    previousLobbyCountRef.current = lobbyCount;
    hasSeenInitialLobbyCountRef.current = true;
  }, [isModerator, lobbyCount]);

  // Stats sampling - only runs when call health panel is active
  // Polls every 2 seconds for responsive diagnostics display
  const settingsView = useSettingsView();
  
  useCallHealthMonitor({
    room,
    localParticipant,
    isActive: settingsOpen && settingsView === 'call-health',
    selectedQualityMode,
    setCallMetrics,
    setQualityOverride,
    addDiagnosticsEvent,
    qualityOverrideReasonRef,
    scheduleRecovery,
  });

  // Battery monitoring
  useEffect(() => {
    const batteryApi = navigator as Navigator & {
      getBattery?: () => Promise<{
        level: number;
        charging: boolean;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      }>;
    };

    if (!batteryApi.getBattery) {
      setCallMetrics({ batteryLevelPercent: null, batteryCharging: null });
      return;
    }

    let mounted = true;
    const batteryManagerRef: { current: ({ level: number; charging: boolean; addEventListener?: (type: string, handler: () => void) => void; removeEventListener?: (type: string, handler: () => void) => void } & Record<string, unknown>) | null } = { current: null };

    // Define syncBatteryState before using it
    const syncBatteryState = () => {
      if (!batteryManagerRef.current || !mounted) return;
      const level = Math.round(batteryManagerRef.current.level * 100);
      const charging = batteryManagerRef.current.charging;
      setCallMetrics({ batteryLevelPercent: level, batteryCharging: charging });
    };

    void batteryApi.getBattery().then((battery) => {
      if (!mounted) {
        // Component unmounted before battery resolved - no cleanup needed (never attached)
        return;
      }
      batteryManagerRef.current = battery;
      syncBatteryState();
      battery.addEventListener?.('levelchange', syncBatteryState);
      battery.addEventListener?.('chargingchange', syncBatteryState);
    }).catch((error) => {
      if (!mounted) return;
      logger.warn('Battery status unavailable:', error);
      setCallMetrics({ batteryLevelPercent: null, batteryCharging: null });
    });

    return () => {
      mounted = false;
      // Use ref to ensure cleanup works even if promise resolved after unmount
      if (batteryManagerRef.current) {
        batteryManagerRef.current.removeEventListener?.('levelchange', syncBatteryState);
        batteryManagerRef.current.removeEventListener?.('chargingchange', syncBatteryState);
      }
    };
  }, [selectedQualityMode, setCallMetrics]);

  const isMobile = useIsMobile();

  // Mobile: enforce single-panel exclusivity synchronously (before browser paint)
  const prevPanelState = useRef({ chat: chatOpen, participants: participantsOpen, settings: settingsOpen });
  useLayoutEffect(() => {
    if (!isMobile) {
      prevPanelState.current = { chat: chatOpen, participants: participantsOpen, settings: settingsOpen };
      return;
    }
    const chatJustOpened = chatOpen && !prevPanelState.current.chat;
    const participantsJustOpened = participantsOpen && !prevPanelState.current.participants;
    const settingsJustOpened = settingsOpen && !prevPanelState.current.settings;
    if (chatJustOpened) {
      if (participantsOpen) toggleParticipants();
      if (settingsOpen) toggleSettings();
    } else if (participantsJustOpened) {
      if (chatOpen) toggleChat();
      if (settingsOpen) toggleSettings();
    } else if (settingsJustOpened) {
      if (chatOpen) toggleChat();
      if (participantsOpen) toggleParticipants();
    }
    prevPanelState.current = { chat: chatOpen, participants: participantsOpen, settings: settingsOpen };
  }, [chatOpen, participantsOpen, settingsOpen, isMobile, toggleChat, toggleParticipants, toggleSettings]);

  const renderLayout = () => {
    switch (layout) {
      case 'grid': return <GridLayout />;
      case 'screenshare': return <ScreenShareLayout />;
      case 'whiteboard': return <WhiteboardLayout room={room} roomName={_props.roomName} />;
      default: return <SpeakerLayout activeSpeakers={activeSpeakers} />;
    }
  };

  const panelTitle = chatOpen ? 'Chat' : participantsOpen ? 'Participants' : settingsOpen ? 'Settings' : '';
  const anyPanelOpen = chatOpen || participantsOpen || settingsOpen;

  return (
    <ParticipantVisibilityProvider>
      <RoomCameraTracksProvider>
      <div className="flex flex-col bg-surface-900 text-white overflow-hidden h-dvh overscroll-none">
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 min-w-0 p-1.5 sm:p-3 flex flex-col" style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top, 0px))' }}>
            {meetingRoomConfig.features.inlineLobbyBanner && isModerator && lobbyCount > 0 && (
              <div className="mb-2 sm:mb-3 rounded-lg border border-warning-200 dark:border-warning-700 bg-warning-50 dark:bg-warning-900/20 px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3 animate-fade-in">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-warning-500 flex items-center justify-center">
                    <Users size={14} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-warning-800 dark:text-warning-200">
                      {lobbyCount === 1 ? 'Someone is waiting in the lobby' : `${lobbyCount} people are waiting in the lobby`}
                    </p>
                    <p className="text-[10px] sm:text-xs text-warning-600 dark:text-warning-400 hidden sm:block">
                      Open the People panel to admit or deny them.
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleParticipants}
                  className="btn-secondary btn-sm shrink-0 bg-white dark:bg-surface-700 border-warning-200 dark:border-warning-700 text-warning-700 dark:text-warning-300 hover:bg-warning-100 dark:hover:bg-surface-600 text-xs"
                >
                  Review
                </button>
              </div>
            )}
            
            <div className="flex-1 min-h-0 relative">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full text-surface-400 text-sm">
                  <div className="w-6 h-6 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mr-2" />
                  Loading layout…
                </div>
              }>
                {renderLayout()}
              </Suspense>
              

            </div>
          </div>

          {!isMobile && (
            <>
              {chatOpen && (
                <Suspense fallback={<PanelLoader />}>
                  <ChatPanel roomName={_props.roomName} />
                </Suspense>
              )}
              {participantsOpen && (
                <Suspense fallback={<PanelLoader />}>
                  <ParticipantsPanel />
                </Suspense>
              )}
              {settingsOpen && (
                <Suspense fallback={<PanelLoader />}>
                  <SettingsPanel />
                </Suspense>
              )}
            </>
          )}
        </div>

        {isMobile && (
          <MobileSheet
            open={anyPanelOpen}
            onClose={() => {
              if (chatOpen) toggleChat();
              if (participantsOpen) toggleParticipants();
              if (settingsOpen) toggleSettings();
            }}
            title={panelTitle}
          >
            {chatOpen && (
              <Suspense fallback={<PanelLoader />}>
                <ChatPanel roomName={_props.roomName} />
              </Suspense>
            )}
            {participantsOpen && (
              <Suspense fallback={<PanelLoader />}>
                <ParticipantsPanel />
              </Suspense>
            )}
            {settingsOpen && (
              <Suspense fallback={<PanelLoader />}>
                <SettingsPanel />
              </Suspense>
            )}
          </MobileSheet>
        )}

        <ControlBar />
        
        <RoomAudioRenderer />
      </div>
      </RoomCameraTracksProvider>
    </ParticipantVisibilityProvider>
  );
}

export const ConferenceRoom = memo(ConferenceRoomInner);
