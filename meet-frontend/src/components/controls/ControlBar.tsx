/**
 * ControlBar - Main meeting controls
 * 
 * Refactored to use memoized sub-components and extracted hooks for better performance.
 * Each button only re-renders when its specific state changes.
 */

import { useLocalParticipant, useMaybeRoomContext } from '@livekit/components-react';
import {
  Mic, Monitor, Users,
  Hand, LayoutGrid, MoreVertical,
  Link2, Bell, BellOff, FlipHorizontal, Activity, Sparkles,
  SquarePlay, Lock, Unlock, DoorOpen, PictureInPicture2, Pencil
} from 'lucide-react';
import {
  useLayout,
  useChatOpen,
  useParticipantsOpen,
  useSettingsOpen,
  useWhiteboardOpen,
  useUnreadCount,
  useMentionCount,
  useHasRaisedHand,
  useIsRecording,
  useEgressId,
  useIsModerator,
  useLobbyCount,
  useJoinLeaveSoundsEnabled,
  useMirrorLocalVideo,
  useQualityMode,
  useSelectedQualityMode,
  useScreenShareMode,
  useAutoFallbackActive,
  useConnectionQualityLabel,
  useQualityOverrideReason,
  useConnectionActions,
  useUIActions,
  useFeatureActions,
  useMeetingLocked,
  useLobbyEnabled,
  useParticipantsCanShareScreen,
  useParticipantsCanChat,
  useParticipantsCanUnmute,
  useParticipantsCanTurnOnCamera,
  useMeetingControlsActions,
  useGridAspectRatio,
  useIsPiPOpen,
} from '../../store/roomStore';
import { roomsApi } from '../../services/api';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { usePictureInPicture } from '../../hooks/usePictureInPicture';
import { useAudioControls } from '../../hooks/useAudioControls';
import { useVideoControls } from '../../hooks/useVideoControls';
import { useScreenShareControls } from '../../hooks/useScreenShareControls';
import { useMeetingActions } from '../../hooks/useMeetingActions';
import logger from '../../utils/logger';

// Import memoized button components
import {
  MicButton,
  CameraButton,
  ScreenShareButton,
  HandButton,
  LayoutButton,
  ChatButton,
  ParticipantsButton,
  WhiteboardButton,
  LeaveButton,
  MobileMicButton,
  MobileCameraButton,
  MobileChatButton,
  MobileLeaveButton,
  ControlsMenu,
  MoreMenu,
  MoreIcon,
  ControlsIcon,
  ControlsIconUnlocked,
  RecordingButton,
  MobileRecordingButton,
} from './ControlBarButtons';

export function ControlBar() {
  const { localParticipant } = useLocalParticipant();
  const room = useMaybeRoomContext();

  // Optimized selectors - each hook only subscribes to specific state
  const layout = useLayout();
  const chatOpen = useChatOpen();
  const participantsOpen = useParticipantsOpen();
  const settingsOpen = useSettingsOpen();
  const whiteboardOpen = useWhiteboardOpen();
  const unreadCount = useUnreadCount();
  const mentionCount = useMentionCount();
  const isRecording = useIsRecording();
  const egressId = useEgressId();
  const isModerator = useIsModerator();
  const lobbyCount = useLobbyCount();
  const joinLeaveSoundsEnabled = useJoinLeaveSoundsEnabled();
  const mirrorLocalVideo = useMirrorLocalVideo();
  const qualityMode = useQualityMode();
  const selectedQualityMode = useSelectedQualityMode();
  const screenShareMode = useScreenShareMode();
  const autoFallbackActive = useAutoFallbackActive();
  const connectionQualityLabel = useConnectionQualityLabel();
  const qualityOverrideReason = useQualityOverrideReason();
  const gridAspectRatio = useGridAspectRatio();

  // Meeting controls selectors
  const meetingLocked = useMeetingLocked();
  const lobbyEnabled = useLobbyEnabled();
  const participantsCanShareScreen = useParticipantsCanShareScreen();
  const participantsCanChat = useParticipantsCanChat();
  const participantsCanUnmute = useParticipantsCanUnmute();
  const participantsCanTurnOnCamera = useParticipantsCanTurnOnCamera();

  // Action hooks (stable references)
  const { setLayout, toggleChat, toggleParticipants, toggleWhiteboard, openSettingsView, setLobbyCount, toggleJoinLeaveSounds, toggleMirrorLocalVideo } = useUIActions();
  const { togglePiP } = useConnectionActions();
  const { raiseHand, lowerHand, setRecording } = useFeatureActions();
  const {
    setMeetingLocked,
    setLobbyEnabled,
    setParticipantsCanShareScreen,
    setParticipantsCanChat,
    setParticipantsCanUnmute,
    setParticipantsCanTurnOnCamera,
  } = useMeetingControlsActions();

  // Extracted hooks
  const audioControls = useAudioControls(localParticipant, room ?? undefined);
  const videoControls = useVideoControls(localParticipant, room ?? undefined, qualityMode, gridAspectRatio);
  const { toggleScreenShare } = useScreenShareControls(localParticipant, qualityMode, screenShareMode);
  const { leaveRoom, endMeeting, hasOtherParticipants } = useMeetingActions();

  // PiP support detection
  const { isDocumentPiPSupported: isPiPSupported } = usePictureInPicture();
  const isPiPOpen = useIsPiPOpen();

  if (import.meta.env.DEV) logger.debug('[ControlBar] PiP state:', { isPiPSupported, isPiPOpen });

  // Local state for menus
  const [showMore, setShowMore] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);

  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const controlsButtonRef = useRef<HTMLButtonElement>(null);

  // Derived state
  const isMicMuted = !localParticipant?.isMicrophoneEnabled;
  const isCameraOff = !localParticipant?.isCameraEnabled;
  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const handRaised = useHasRaisedHand(localParticipant?.identity || '');

  // Lobby count - poll periodically for moderators
  useEffect(() => {
    if (!room || !isModerator) {
      setLobbyCount(0);
      return;
    }

    const fetchLobbyCount = async () => {
      try {
        const res = await roomsApi.getLobby(room.name);
        const lobby = res.data.lobby || [];
        setLobbyCount(lobby.length);
      } catch {
        // Silently ignore errors (e.g., when lobby is disabled)
      }
    };

    void fetchLobbyCount();
    const pollInterval = setInterval(() => { void fetchLobbyCount(); }, 5000);

    return () => { clearInterval(pollInterval); };
  }, [room, isModerator, setLobbyCount]);

  // Hand raise
  const toggleHandRaise = useCallback(async () => {
    if (!room || !localParticipant) return;
    const payload = {
      type: handRaised ? 'lower_hand' : 'raise_hand',
      identity: localParticipant.identity,
    };
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        { reliable: true }
      );
      if (handRaised) {
        lowerHand(localParticipant.identity);
      } else {
        raiseHand(localParticipant.identity);
      }
    } catch (err) {
      logger.error('Failed to toggle hand raise:', err);
      toast.error('Failed to toggle hand raise');
    }
  }, [room, localParticipant, handRaised, raiseHand, lowerHand]);

  // Copy link
  const copyRoomLink = useCallback(async () => {
    if (!room?.name) return;
    const joinUrl = `${window.location.origin}/join/${room.name}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success('Meeting link copied');
    } catch (error) {
      logger.error('Failed to copy meeting link:', error);
      toast.error('Failed to copy meeting link');
    }
  }, [room]);

  // Recording toggle
  const toggleRecording = useCallback(async () => {
    if (!room?.name) return;
    setIsRecordingLoading(true);
    try {
      if (isRecording && egressId) {
        await roomsApi.stopRecording(egressId);
        setRecording(false);
        // Broadcast recording state to all participants
        try {
          const msg = JSON.stringify({ type: 'recording_state', isRecording: false });
          localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true, topic: 'meeting' });
        } catch {}
      } else {
        const res = await roomsApi.startRecording(room.name);
        const newEgressId = res.data.egressId;
        setRecording(true, newEgressId ?? undefined);
        // Broadcast recording state to all participants
        try {
          const msg = JSON.stringify({ type: 'recording_state', isRecording: true, egressId: newEgressId });
          localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true, topic: 'meeting' });
        } catch {}
        toast.success('Recording started');
      }
    } catch (error) {
      logger.error('Failed to toggle recording:', error);
      toast.error(isRecording ? 'Failed to stop recording' : 'Failed to start recording');
    } finally {
      setIsRecordingLoading(false);
    }
  }, [room, isRecording, egressId, setRecording]);

  const toggleLayout = useCallback(() => {
    // Don't cycle through whiteboard mode here — that's toggled by its own button
    const effectiveLayout = layout === 'whiteboard' ? 'speaker' : layout;
    setLayout(effectiveLayout === 'grid' ? 'speaker' : 'grid');
  }, [layout, setLayout]);

  const broadcastMeetingSettings = useCallback(async (settings: {
    meetingLocked: boolean;
    lobbyEnabled: boolean;
    participantsCanShareScreen: boolean;
    participantsCanChat: boolean;
    participantsCanUnmute: boolean;
    participantsCanTurnOnCamera: boolean;
  }) => {
    if (!localParticipant) return;
    try {
      await localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({
          type: 'meeting_settings_update',
          ...settings,
          senderIdentity: localParticipant.identity,
        })),
        { reliable: true }
      );
    } catch (err) {
      logger.warn('[ControlBar] Failed to broadcast meeting settings:', err);
    }
  }, [localParticipant]);

  const handleToggleLock = useCallback(async () => {
    const newVal = !meetingLocked;
    setMeetingLocked(newVal);
    await broadcastMeetingSettings({
      meetingLocked: newVal, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
    });
  }, [meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setMeetingLocked, broadcastMeetingSettings]);

  const handleToggleLobby = useCallback(async () => {
    const newVal = !lobbyEnabled;
    setLobbyEnabled(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled: newVal, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
    });
  }, [meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setLobbyEnabled, broadcastMeetingSettings]);

  const handleToggleParticipantScreenShare = useCallback(async () => {
    const newVal = !participantsCanShareScreen;
    setParticipantsCanShareScreen(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen: newVal,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
    });
  }, [meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanShareScreen, broadcastMeetingSettings]);

  const handleToggleParticipantChat = useCallback(async () => {
    const newVal = !participantsCanChat;
    setParticipantsCanChat(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat: newVal, participantsCanUnmute, participantsCanTurnOnCamera,
    });
  }, [meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanChat, broadcastMeetingSettings]);

  const handleToggleParticipantUnmute = useCallback(async () => {
    const newVal = !participantsCanUnmute;
    setParticipantsCanUnmute(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute: newVal, participantsCanTurnOnCamera,
    });
  }, [meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanUnmute, broadcastMeetingSettings]);

  const handleToggleParticipantCamera = useCallback(async () => {
    const newVal = !participantsCanTurnOnCamera;
    setParticipantsCanTurnOnCamera(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera: newVal,
    });
  }, [meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanTurnOnCamera, broadcastMeetingSettings]);

  // More menu items
  const moreMenuItems = [
    { icon: <Link2 size={16} />, label: 'Copy Meeting Link', onClick: copyRoomLink },
    ...(isPiPSupported ? [{
      icon: <PictureInPicture2 size={16} />,
      label: isPiPOpen ? 'Close Picture-in-Picture' : 'Open Picture-in-Picture',
      onClick: () => togglePiP(),
    }] : []),
    ...(meetingRoomConfig.features.joinLeaveSoundToggle ? [{
      icon: joinLeaveSoundsEnabled ? <Bell size={16} /> : <BellOff size={16} />,
      label: joinLeaveSoundsEnabled ? 'Mute Sounds' : 'Enable Sounds',
      onClick: toggleJoinLeaveSounds,
    }] : []),
    ...(meetingRoomConfig.features.mirrorLocalVideoToggle ? [{
      icon: <FlipHorizontal size={16} />,
      label: mirrorLocalVideo ? 'Unmirror My Tile' : 'Mirror My Tile',
      onClick: toggleMirrorLocalVideo,
    }] : []),
    ...(meetingRoomConfig.features.settingsPanelDeviceFallback ? [{
      icon: <Mic size={16} />,
      label: settingsOpen ? 'Close Device Settings' : 'Device Settings',
      onClick: () => openSettingsView('devices'),
    }] : []),
    { icon: <Activity size={16} />, label: 'Call Health', onClick: () => openSettingsView('call-health') },
    { icon: <Sparkles size={16} />, label: 'Video Effects', onClick: () => openSettingsView('video-effects') },
  ];

  // Mobile more menu items (extended)
  const mobileMoreMenuItems = [
    { icon: <Monitor size={16} />, label: isScreenSharing ? 'Stop Share' : 'Share Screen', onClick: toggleScreenShare },
    { icon: <Hand size={16} className={handRaised ? 'text-warning-500' : ''} />, label: handRaised ? 'Lower Hand' : 'Raise Hand', onClick: toggleHandRaise },
    { icon: layout === 'grid' ? <SquarePlay size={16} /> : <LayoutGrid size={16} />, label: layout === 'grid' ? 'Speaker View' : 'Grid View', onClick: toggleLayout },
    ...(isPiPSupported ? [{
      icon: <PictureInPicture2 size={16} />,
      label: isPiPOpen ? 'Close Picture-in-Picture' : 'Open Picture-in-Picture',
      onClick: () => togglePiP(),
    }] : []),
    ...(meetingRoomConfig.features.mirrorLocalVideoToggle ? [{
      icon: <FlipHorizontal size={16} />,
      label: mirrorLocalVideo ? 'Unmirror My Tile' : 'Mirror My Tile',
      onClick: toggleMirrorLocalVideo,
    }] : []),
    ...(meetingRoomConfig.features.settingsPanelDeviceFallback ? [{
      icon: <Mic size={16} />,
      label: settingsOpen ? 'Close Device Settings' : 'Device Settings',
      onClick: () => openSettingsView('devices'),
    }] : []),
    { icon: <Activity size={16} />, label: 'Call Health', onClick: () => openSettingsView('call-health') },
    { icon: <Sparkles size={16} />, label: 'Video Effects', onClick: () => openSettingsView('video-effects') },
    {
      icon: <Users size={16} />,
      label: 'People',
      onClick: () => {
        toggleParticipants();
      },
    },
    { icon: <Link2 size={16} />, label: 'Copy Link', onClick: copyRoomLink },
    { icon: <Pencil size={16} />, label: whiteboardOpen ? 'Close Whiteboard' : 'Whiteboard', onClick: () => {
      toggleWhiteboard();
      // Broadcast to other participants so they also switch layout
      if (room) {
        const msg = JSON.stringify({ type: 'whiteboard-activate', active: !whiteboardOpen });
        room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true, topic: 'whiteboard' }).catch(() => {});
      }
    }},
    ...(isModerator ? [
      { icon: meetingLocked ? <Lock size={16} className="text-warning-400" /> : <Unlock size={16} />, label: meetingLocked ? 'Unlock Meeting' : 'Lock Meeting', onClick: handleToggleLock },
      { icon: <DoorOpen size={16} />, label: lobbyEnabled ? 'Disable Lobby' : 'Enable Lobby', onClick: handleToggleLobby },
    ] : []),
  ];

  return (
    <div className="relative">
      {/* Desktop Layout */}
      <div className="hidden md:flex items-center justify-center gap-2 bg-surface-800/95 backdrop-blur-sm border-t border-surface-700 py-3 px-4">
        {/* Connection Quality Indicator */}
        {(meetingRoomConfig.features.connectionQualityIndicator || autoFallbackActive) && (
          <div className={cn(
            'mr-3 rounded-full px-3 py-1 text-xs font-medium',
            connectionQualityLabel === 'excellent' || connectionQualityLabel === 'good'
              ? 'bg-success-500/15 text-success-300'
              : connectionQualityLabel === 'poor' || connectionQualityLabel === 'lost'
                ? 'bg-danger-500/15 text-danger-300'
                : 'bg-warning-500/15 text-warning-200'
          )}>
            {autoFallbackActive
              ? `Auto ${qualityMode === 'dataSaver' ? 'Data Saver' : 'Audio Only'}`
              : `Connection ${connectionQualityLabel}`}
            {autoFallbackActive && selectedQualityMode !== qualityMode ? ` from ${qualityOverrideReason}` : ''}
          </div>
        )}

        {/* Primary Controls Group */}
        <div className="flex items-center gap-2">
          <MicButton
            isMuted={isMicMuted}
            onToggle={audioControls.toggleMic}
            showDeviceMenu={meetingRoomConfig.features.micDropdownDeviceMenu}
            mics={audioControls.mics}
            speakers={audioControls.speakers}
            activeMicId={audioControls.activeMicId}
            activeSpeakerId={audioControls.activeSpeakerId}
            onSwitchMic={audioControls.switchMic}
            onSwitchSpeaker={audioControls.switchSpeaker}
          />
          <CameraButton
            isOff={isCameraOff}
            onToggle={videoControls.toggleCamera}
            showDeviceMenu={meetingRoomConfig.features.cameraDropdownDeviceMenu}
            cameras={videoControls.cameras}
            activeCameraId={videoControls.activeCameraId}
            onSwitchCamera={videoControls.switchCamera}
          />
          <ScreenShareButton isSharing={isScreenSharing} onToggle={toggleScreenShare} />
          {isModerator && (
            <RecordingButton isRecording={isRecording} isLoading={isRecordingLoading} onToggle={toggleRecording} />
          )}
        </div>

        <div className="w-px h-10 bg-surface-600 mx-2" />

        {/* Secondary Controls Group */}
        <div className="flex items-center gap-2">
          <HandButton isRaised={handRaised} onToggle={toggleHandRaise} />
          <LayoutButton layout={layout} onToggle={toggleLayout} />
        </div>

        <div className="w-px h-10 bg-surface-600 mx-2" />

        {/* Communication Controls Group */}
        <div className="flex items-center gap-2">
          <ChatButton isOpen={chatOpen} unreadCount={unreadCount} mentionCount={mentionCount} onToggle={toggleChat} />
          <ParticipantsButton isOpen={participantsOpen} lobbyCount={lobbyCount} isModerator={isModerator} onToggle={toggleParticipants} />
          <WhiteboardButton isOpen={whiteboardOpen} onToggle={() => {
            toggleWhiteboard();
            if (room) {
              const msg = JSON.stringify({ type: 'whiteboard-activate', active: !whiteboardOpen });
              room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true, topic: 'whiteboard' }).catch(() => {});
            }
          }} />

          {/* Controls - Moderators only */}
          {isModerator && (
            <div className="relative">
              <button
                ref={controlsButtonRef}
                onClick={() => setShowControls(!showControls)}
                aria-label="Meeting controls"
                aria-expanded={showControls}
                aria-haspopup="true"
                className={cn(
                  'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 min-w-[64px] min-h-[52px] relative',
                  meetingLocked
                    ? 'bg-warning-500 hover:bg-warning-600 text-surface-900 shadow-sm'
                    : 'bg-surface-700/60 hover:bg-surface-600 text-surface-200'
                )}
              >
                {meetingLocked ? <ControlsIcon size={18} /> : <ControlsIconUnlocked size={18} />}
                <span>Controls</span>
                {meetingLocked && (
                  <span className="absolute -top-1 -right-1 bg-warning-500 text-surface-900 text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
                    <Lock size={10} />
                  </span>
                )}
              </button>
              <ControlsMenu
                show={showControls}
                onClose={() => setShowControls(false)}
                meetingLocked={meetingLocked}
                lobbyEnabled={lobbyEnabled}
                participantsCanShareScreen={participantsCanShareScreen}
                participantsCanChat={participantsCanChat}
                participantsCanUnmute={participantsCanUnmute}
                participantsCanTurnOnCamera={participantsCanTurnOnCamera}
                onToggleLock={handleToggleLock}
                onToggleLobby={handleToggleLobby}
                onToggleScreenShare={handleToggleParticipantScreenShare}
                onToggleChat={handleToggleParticipantChat}
                onToggleUnmute={handleToggleParticipantUnmute}
                onToggleCamera={handleToggleParticipantCamera}
              />
            </div>
          )}

          {/* More options */}
          <div className="relative">
            <button
              ref={moreButtonRef}
              onClick={() => setShowMore(!showMore)}
              aria-label="More options"
              aria-expanded={showMore}
              aria-haspopup="true"
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 min-w-[64px] min-h-[52px] bg-surface-700/60 hover:bg-surface-600 text-surface-200"
            >
              <MoreIcon size={18} />
              <span>More</span>
            </button>
            <MoreMenu show={showMore} onClose={() => setShowMore(false)} items={moreMenuItems} isRecording={isRecording} />
          </div>
        </div>

        <div className="w-px h-10 bg-surface-600 mx-2" />

        {/* Leave */}
        <LeaveButton 
          onLeave={leaveRoom} 
          onEndMeeting={endMeeting}
          isModerator={isModerator} 
          hasOtherParticipants={hasOtherParticipants}
        />
      </div>

      {/* Mobile Layout */}
      <div className="md:hidden flex items-center justify-between bg-surface-800/95 backdrop-blur-sm border-t border-surface-700 py-2 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Left: Primary Controls */}
        <div className="flex items-center gap-1.5">
          <MobileMicButton isMuted={isMicMuted} onToggle={audioControls.toggleMic} />
          <MobileCameraButton isOff={isCameraOff} onToggle={videoControls.toggleCamera} />
        </div>

        {/* Center: Leave */}
        <MobileLeaveButton 
          onLeave={leaveRoom} 
          onEndMeeting={endMeeting}
          isModerator={isModerator}
          hasOtherParticipants={hasOtherParticipants}
        />

        {/* Right: Secondary Controls */}
        <div className="flex items-center gap-1.5">
          <MobileChatButton isOpen={chatOpen} unreadCount={unreadCount} mentionCount={mentionCount} onToggle={toggleChat} />
          {isModerator && (
            <MobileRecordingButton isRecording={isRecording} isLoading={isRecordingLoading} onToggle={toggleRecording} />
          )}
          <div className="relative">
            <button
              ref={moreButtonRef}
              onClick={() => setShowMore(!showMore)}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-all min-w-[48px] min-h-[48px] bg-surface-700/60 hover:bg-surface-600 text-surface-300"
              aria-label="More options"
              aria-expanded={showMore}
            >
              <MoreVertical size={20} aria-hidden="true" />
            </button>
            <MoreMenu show={showMore} onClose={() => setShowMore(false)} items={mobileMoreMenuItems} />
          </div>
        </div>
      </div>
    </div>
  );
}