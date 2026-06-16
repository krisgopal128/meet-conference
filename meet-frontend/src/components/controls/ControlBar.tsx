/**
 * ControlBar - Main meeting controls
 * 
 * Refactored to use memoized sub-components and extracted hooks for better performance.
 * Each button only re-renders when its specific state changes.
 */

import { useLocalParticipant, useMaybeRoomContext } from '@livekit/components-react';
import { MoreVertical, Lock } from 'lucide-react';
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
import { withOperationTimeout } from '../../utils/asyncTimeout';
import { updateRoomSettings } from '../../services/api';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import toast from 'react-hot-toast';
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '../../utils/cn';
import { usePictureInPicture } from '../../hooks/usePictureInPicture';
import { useAudioControls } from '../../hooks/useAudioControls';
import { useVideoControls } from '../../hooks/useVideoControls';
import { useScreenShareControls } from '../../hooks/useScreenShareControls';
import { useMeetingActions } from '../../hooks/useMeetingActions';
import { useLobbyPolling } from '../../hooks/useLobbyPolling';
import type { LobbyParticipant } from '../../types/api';
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
  MoreIcon,
  ControlsIcon,
  ControlsIconUnlocked,
  RecordingButton,
  MemoizedMoreMenu,
  MemoizedMobileMoreMenu,
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

  const handleToggleMic = useCallback(async () => {
    if (!localParticipant) return;
    if (!localParticipant.isMicrophoneEnabled && !isModerator && !participantsCanUnmute) {
      toast.error('The host has disabled self-unmute');
      return;
    }
    await audioControls.toggleMic();
  }, [audioControls, isModerator, localParticipant, participantsCanUnmute]);

  const handleToggleCamera = useCallback(async () => {
    if (!localParticipant) return;
    if (!localParticipant.isCameraEnabled && !isModerator && !participantsCanTurnOnCamera) {
      toast.error('The host has disabled self camera enable');
      return;
    }
    await videoControls.toggleCamera();
  }, [videoControls, isModerator, localParticipant, participantsCanTurnOnCamera]);

  const handleToggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    if (!localParticipant.isScreenShareEnabled && !isModerator && !participantsCanShareScreen) {
      toast.error('The host has disabled participant screen sharing');
      return;
    }
    await toggleScreenShare();
  }, [isModerator, localParticipant, participantsCanShareScreen, toggleScreenShare]);

  // PiP support detection
  const { isDocumentPiPSupported: isPiPSupported } = usePictureInPicture();
  const isPiPOpen = useIsPiPOpen();

  if (import.meta.env.DEV) logger.debug('[ControlBar] PiP state:', { isPiPSupported, isPiPOpen });

  // Local state for menus
  const [showMore, setShowMore] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [isRecordingLoading, setIsRecordingLoading] = useState(false);

  const moreButtonRefDesktop = useRef<HTMLButtonElement>(null);
  const moreButtonRefMobile = useRef<HTMLButtonElement>(null);
  const controlsButtonRef = useRef<HTMLButtonElement>(null);

  // Derived state
  const isMicMuted = !localParticipant?.isMicrophoneEnabled;
  const isCameraOff = !localParticipant?.isCameraEnabled;
  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const handRaised = useHasRaisedHand(localParticipant?.identity || '');

  useEffect(() => {
    if (!room || !isModerator) {
      setLobbyCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, setLobbyCount]);

  const handleLobbyUpdate = useCallback((lobby: LobbyParticipant[]) => {
    setLobbyCount(lobby.length);
  }, [setLobbyCount]);

  useLobbyPolling(room?.name, !!room && isModerator, handleLobbyUpdate);

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
        await withOperationTimeout(
          roomsApi.stopRecording(egressId),
          'RECORDING',
          'Stop recording'
        );
        setRecording(false);
        toast.success('Recording stopped');
        try {
          const msg = JSON.stringify({ type: 'recording_state', isRecording: false });
          localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true, topic: 'meeting' });
        } catch {}
      } else {
        const res = await withOperationTimeout(
          roomsApi.startRecording(room.name),
          'RECORDING',
          'Start recording'
        );
        const newEgressId = res.data.egressId;
        setRecording(true, newEgressId ?? undefined);
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
  }, [room, isRecording, egressId, setRecording, localParticipant]);

  const toggleLayout = useCallback(() => {
    // Don't cycle through whiteboard mode here — that's toggled by its own button
    const effectiveLayout = layout === 'whiteboard' ? 'speaker' : layout;
    setLayout(effectiveLayout === 'grid' ? 'speaker' : 'grid');
  }, [layout, setLayout]);

  const handleToggleWhiteboard = useCallback(() => {
    if (!isModerator) {
      toast.error('Only moderators can toggle the whiteboard');
      return;
    }
    toggleWhiteboard();
    if (room) {
      const msg = JSON.stringify({ type: 'whiteboard-activate', active: !whiteboardOpen });
      room.localParticipant.publishData(new TextEncoder().encode(msg), { reliable: true, topic: 'whiteboard' }).catch(() => {});
    }
  }, [toggleWhiteboard, room, whiteboardOpen, isModerator]);

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
    const prevVal = meetingLocked;
    const newVal = !meetingLocked;
    setMeetingLocked(newVal);
    await broadcastMeetingSettings({
      meetingLocked: newVal, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
    });
    if (room?.name) {
      try {
        await updateRoomSettings(room.name, { meetingLocked: newVal });
      } catch (err) {
        logger.error('Failed to persist meeting lock:', err);
        setMeetingLocked(prevVal);
        await broadcastMeetingSettings({
          meetingLocked: prevVal, lobbyEnabled, participantsCanShareScreen,
          participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
        });
        toast.error('Failed to update setting — reverted');
      }
    }
  }, [room, meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setMeetingLocked, broadcastMeetingSettings]);

  const handleToggleLobby = useCallback(async () => {
    const prevVal = lobbyEnabled;
    const newVal = !lobbyEnabled;
    setLobbyEnabled(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled: newVal, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
    });
    try {
      if (!room?.name) return;
      await roomsApi.update(room.name, { waitingRoomEnabled: newVal });
    } catch (err) {
      logger.error('Failed to persist lobby toggle:', err);
      setLobbyEnabled(prevVal);
      await broadcastMeetingSettings({
        meetingLocked, lobbyEnabled: prevVal, participantsCanShareScreen,
        participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
      });
      toast.error('Failed to update setting — reverted');
    }
  }, [room, meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setLobbyEnabled, broadcastMeetingSettings]);

  const handleToggleParticipantScreenShare = useCallback(async () => {
    const prevVal = participantsCanShareScreen;
    const newVal = !participantsCanShareScreen;
    setParticipantsCanShareScreen(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen: newVal,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
    });
    if (room?.name) {
      try {
        await updateRoomSettings(room.name, { participantsCanShareScreen: newVal });
      } catch (err) {
        logger.error('Failed to persist screen share control:', err);
        setParticipantsCanShareScreen(prevVal);
        await broadcastMeetingSettings({
          meetingLocked, lobbyEnabled, participantsCanShareScreen: prevVal,
          participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera,
        });
        toast.error('Failed to update setting — reverted');
      }
    }
  }, [room, meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanShareScreen, broadcastMeetingSettings]);

  const handleToggleParticipantChat = useCallback(async () => {
    const prevVal = participantsCanChat;
    const newVal = !participantsCanChat;
    setParticipantsCanChat(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat: newVal, participantsCanUnmute, participantsCanTurnOnCamera,
    });
    if (room?.name) {
      try {
        await updateRoomSettings(room.name, { participantsCanChat: newVal });
      } catch (err) {
        logger.error('Failed to persist chat control:', err);
        setParticipantsCanChat(prevVal);
        await broadcastMeetingSettings({
          meetingLocked, lobbyEnabled, participantsCanShareScreen,
          participantsCanChat: prevVal, participantsCanUnmute, participantsCanTurnOnCamera,
        });
        toast.error('Failed to update setting — reverted');
      }
    }
  }, [room, meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanChat, broadcastMeetingSettings]);

  const handleToggleParticipantUnmute = useCallback(async () => {
    const prevVal = participantsCanUnmute;
    const newVal = !participantsCanUnmute;
    setParticipantsCanUnmute(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute: newVal, participantsCanTurnOnCamera,
    });
    if (room?.name) {
      try {
        await updateRoomSettings(room.name, { participantsCanUnmute: newVal });
      } catch (err) {
        logger.error('Failed to persist unmute control:', err);
        setParticipantsCanUnmute(prevVal);
        await broadcastMeetingSettings({
          meetingLocked, lobbyEnabled, participantsCanShareScreen,
          participantsCanChat, participantsCanUnmute: prevVal, participantsCanTurnOnCamera,
        });
        toast.error('Failed to update setting — reverted');
      }
    }
  }, [room, meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanUnmute, broadcastMeetingSettings]);

  const handleToggleParticipantCamera = useCallback(async () => {
    const prevVal = participantsCanTurnOnCamera;
    const newVal = !participantsCanTurnOnCamera;
    setParticipantsCanTurnOnCamera(newVal);
    await broadcastMeetingSettings({
      meetingLocked, lobbyEnabled, participantsCanShareScreen,
      participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera: newVal,
    });
    if (room?.name) {
      try {
        await updateRoomSettings(room.name, { participantsCanTurnOnCamera: newVal });
      } catch (err) {
        logger.error('Failed to persist camera control:', err);
        setParticipantsCanTurnOnCamera(prevVal);
        await broadcastMeetingSettings({
          meetingLocked, lobbyEnabled, participantsCanShareScreen,
          participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera: prevVal,
        });
        toast.error('Failed to update setting — reverted');
      }
    }
  }, [room, meetingLocked, lobbyEnabled, participantsCanShareScreen, participantsCanChat, participantsCanUnmute, participantsCanTurnOnCamera, setParticipantsCanTurnOnCamera, broadcastMeetingSettings]);

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
            onToggle={handleToggleMic}
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
            onToggle={handleToggleCamera}
            showDeviceMenu={meetingRoomConfig.features.cameraDropdownDeviceMenu}
            cameras={videoControls.cameras}
            activeCameraId={videoControls.activeCameraId}
            onSwitchCamera={videoControls.switchCamera}
          />
          <ScreenShareButton isSharing={isScreenSharing} onToggle={handleToggleScreenShare} />
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
          <WhiteboardButton isOpen={whiteboardOpen} onToggle={handleToggleWhiteboard} />

          {/* Controls - Moderators only */}
          {isModerator && (
    <div className="relative z-[60]">
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
              ref={moreButtonRefDesktop}
              onClick={() => setShowMore(!showMore)}
              aria-label="More options"
              aria-expanded={showMore}
              aria-haspopup="true"
              className="flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 min-w-[64px] min-h-[52px] bg-surface-700/60 hover:bg-surface-600 text-surface-200"
            >
              <MoreIcon size={18} />
              <span>More</span>
            </button>
            <MemoizedMoreMenu
              show={showMore}
              onClose={() => setShowMore(false)}
              isRecording={isRecording}
              isPiPSupported={isPiPSupported}
              isPiPOpen={isPiPOpen}
              onTogglePiP={togglePiP}
              joinLeaveSoundsEnabled={joinLeaveSoundsEnabled}
              onToggleJoinLeaveSounds={toggleJoinLeaveSounds}
              mirrorLocalVideo={mirrorLocalVideo}
              onToggleMirrorLocalVideo={toggleMirrorLocalVideo}
              settingsOpen={settingsOpen}
              onOpenSettings={openSettingsView}
              onCopyLink={copyRoomLink}
            />
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
      <div className="md:hidden flex items-center justify-between bg-surface-800/95 backdrop-blur-sm border-t border-surface-700 py-2 px-4 overscroll-behavior-contain" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}>
        {/* Left: Primary Controls */}
        <div className="flex items-center gap-1">
          <MobileMicButton isMuted={isMicMuted} onToggle={handleToggleMic} />
          <MobileCameraButton isOff={isCameraOff} onToggle={handleToggleCamera} />
        </div>

        {/* Center: Leave */}
        <MobileLeaveButton 
          onLeave={leaveRoom} 
          onEndMeeting={endMeeting}
          isModerator={isModerator}
          hasOtherParticipants={hasOtherParticipants}
        />

        {/* Right: Secondary Controls */}
        <div className="flex items-center gap-1">
          <MobileChatButton isOpen={chatOpen} unreadCount={unreadCount} mentionCount={mentionCount} onToggle={toggleChat} />
          <div className="relative">
            <button
              ref={moreButtonRefMobile}
              onClick={() => setShowMore(!showMore)}
              className="flex flex-col items-center justify-center p-2.5 rounded-xl text-xs font-medium transition-all min-w-[48px] min-h-[48px] bg-surface-700/60 hover:bg-surface-600 text-surface-300"
              aria-label="More options"
              aria-expanded={showMore}
            >
              <MoreVertical size={20} aria-hidden="true" />
            </button>
            <MemoizedMobileMoreMenu
              show={showMore}
              onClose={() => setShowMore(false)}
              isRecording={isRecording}
              isRecordingLoading={isRecordingLoading}
              onToggleRecording={toggleRecording}
              isScreenSharing={isScreenSharing}
              onToggleScreenShare={handleToggleScreenShare}
              handRaised={handRaised}
              onToggleHandRaise={toggleHandRaise}
              layout={layout}
              onToggleLayout={toggleLayout}
              isPiPSupported={isPiPSupported}
              isPiPOpen={isPiPOpen}
              onTogglePiP={togglePiP}
              joinLeaveSoundsEnabled={joinLeaveSoundsEnabled}
              onToggleJoinLeaveSounds={toggleJoinLeaveSounds}
              mirrorLocalVideo={mirrorLocalVideo}
              onToggleMirrorLocalVideo={toggleMirrorLocalVideo}
              settingsOpen={settingsOpen}
              onOpenSettings={openSettingsView}
              onToggleParticipants={toggleParticipants}
              onCopyLink={copyRoomLink}
              whiteboardOpen={whiteboardOpen}
              onToggleWhiteboard={handleToggleWhiteboard}
              isModerator={isModerator}
              meetingLocked={meetingLocked}
              lobbyEnabled={lobbyEnabled}
              participantsCanShareScreen={participantsCanShareScreen}
              participantsCanChat={participantsCanChat}
              participantsCanUnmute={participantsCanUnmute}
              participantsCanTurnOnCamera={participantsCanTurnOnCamera}
              onToggleLock={handleToggleLock}
              onToggleLobby={handleToggleLobby}
              onToggleParticipantScreenShare={handleToggleParticipantScreenShare}
              onToggleParticipantChat={handleToggleParticipantChat}
              onToggleParticipantUnmute={handleToggleParticipantUnmute}
              onToggleParticipantCamera={handleToggleParticipantCamera}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
