/**
 * ControlBar - Main meeting controls
 * 
 * Refactored to use memoized sub-components for better performance.
 * Each button only re-renders when its specific state changes.
 */

import { useLocalParticipant, useMaybeRoomContext } from '@livekit/components-react';
import {
  Mic, Monitor, Users,
  Hand, LayoutGrid, MoreVertical,
  Link2, Bell, BellOff, FlipHorizontal, Activity, Sparkles,
  SquarePlay, Lock, Unlock, DoorOpen, PictureInPicture2
} from 'lucide-react';
import {
  useLayout,
  useChatOpen,
  useParticipantsOpen,
  useSettingsOpen,
  useUnreadCount,
  useMentionCount,
  useHasRaisedHand,
  useIsRecording,
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
  // useRoomName, // Disabled for recording feature
} from '../../store/roomStore';
import { roomsApi } from '../../services/api';
import {
  buildAudioCaptureOptions,
  buildCameraCaptureOptions,
  getScreenShareOptions,
  isAudioOnlyMode,
  meetingRoomConfig,
} from '../../config/meetingRoomConfig';
import toast from 'react-hot-toast';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { usePictureInPicture } from '../../hooks/usePictureInPicture';

// Import memoized button components
import {
  MicButton,
  CameraButton,
  ScreenShareButton,
  HandButton,
  LayoutButton,
  ChatButton,
  ParticipantsButton,
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
  // RecordingButton,
  // MobileRecordingButton,
  // RecordingBadge,
} from './ControlBarButtons';

export function ControlBar() {
  const navigate = useNavigate();
  const { localParticipant } = useLocalParticipant();
  const room = useMaybeRoomContext();

  // Optimized selectors - each hook only subscribes to specific state
  const layout = useLayout();
  const chatOpen = useChatOpen();
  const participantsOpen = useParticipantsOpen();
  const settingsOpen = useSettingsOpen();
  const unreadCount = useUnreadCount();
  const mentionCount = useMentionCount();
  const isRecording = useIsRecording();
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
  const { setLayout, toggleChat, toggleParticipants, openSettingsView, setLobbyCount, toggleJoinLeaveSounds, toggleMirrorLocalVideo } = useUIActions();
  const { reset, togglePiP } = useConnectionActions();
  const { raiseHand, lowerHand, setRecording: _setRecording } = useFeatureActions();
  const {
    setMeetingLocked,
    setLobbyEnabled,
    setParticipantsCanShareScreen,
    setParticipantsCanChat,
    setParticipantsCanUnmute,
    setParticipantsCanTurnOnCamera,
  } = useMeetingControlsActions();

  // PiP support detection
  const { isDocumentPiPSupported: isPiPSupported } = usePictureInPicture();
  const isPiPOpen = useIsPiPOpen();

  
  // Debug logging
  console.log('[ControlBar] PiP state:', { isPiPSupported, isPiPOpen });

  // Local state for menus
  const [showMore, setShowMore] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState('');
  const [activeMicId, setActiveMicId] = useState('');
  const [activeSpeakerId, setActiveSpeakerId] = useState('');

  // Recording state - Disabled for now
  const [_recordingLoading, _setRecordingLoading] = useState(false);
  const [_showRecordingConfirm, _setShowRecordingConfirm] = useState(false);

  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const controlsButtonRef = useRef<HTMLButtonElement>(null);

  // Derived state
  const isMicMuted = !localParticipant?.isMicrophoneEnabled;
  const isCameraOff = !localParticipant?.isCameraEnabled;
  const isScreenSharing = localParticipant?.isScreenShareEnabled;
  const handRaised = useHasRaisedHand(localParticipant?.identity || '');

  // Check if there are other participants in the room
  const hasOtherParticipants = room ? room.remoteParticipants.size > 0 : false;

  // Get room name for API calls - used for recording (disabled)
  // const _roomName = useRoomName();

  // Lobby count - poll periodically for moderators to keep badge updated
  useEffect(() => {
    if (!room || !isModerator) {
      setLobbyCount(0);
      return;
    }

    // Fetch lobby count from API
    const fetchLobbyCount = async () => {
      try {
        const res = await roomsApi.getLobby(room.name);
        const lobby = res.data.lobby || [];
        setLobbyCount(lobby.length);
      } catch (error) {
        // Silently ignore errors (e.g., when lobby is disabled)
      }
    };

    // Fetch immediately
    fetchLobbyCount();

    // Poll every 5 seconds for real-time updates
    const pollInterval = setInterval(fetchLobbyCount, 5000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [room, isModerator, setLobbyCount]);

  // Device enumeration
  useEffect(() => {
    if (!room) return;

    const refreshDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((device) => device.kind === 'videoinput'));
        setMics(devices.filter((device) => device.kind === 'audioinput'));
        setSpeakers(devices.filter((device) => device.kind === 'audiooutput'));
        setActiveCameraId(room.getActiveDevice('videoinput') || '');
        setActiveMicId(room.getActiveDevice('audioinput') || '');
        setActiveSpeakerId(room.getActiveDevice('audiooutput') || '');
      } catch (error) {
        console.error('Failed to refresh media devices:', error);
      }
    };

    const handleActiveDeviceChanged = (kind: 'audioinput' | 'videoinput' | 'audiooutput', deviceId: string) => {
      if (kind === 'videoinput') setActiveCameraId(deviceId);
      if (kind === 'audioinput') setActiveMicId(deviceId);
      if (kind === 'audiooutput') setActiveSpeakerId(deviceId);
    };

    void refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    room.on('activeDeviceChanged', handleActiveDeviceChanged);

    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
      room.off('activeDeviceChanged', handleActiveDeviceChanged);
    };
  }, [room]);

  // Action handlers - useCallback for stable references
  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    try {
      const currentlyEnabled = localParticipant.isMicrophoneEnabled;
      await localParticipant.setMicrophoneEnabled(
        !currentlyEnabled,
        !currentlyEnabled ? buildAudioCaptureOptions(activeMicId || undefined) : undefined,
      );
    } catch (error) {
      console.error('Failed to toggle microphone:', error);
      toast.error('Failed to toggle microphone');
    }
  }, [localParticipant, activeMicId]);

  const switchMic = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice('audioinput', deviceId || 'default');
      setActiveMicId(deviceId);
    } catch (error) {
      console.error('Failed to switch microphone:', error);
      toast.error('Failed to switch microphone');
    }
  }, [room]);

  const switchSpeaker = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice('audiooutput', deviceId || 'default');
      setActiveSpeakerId(deviceId);
    } catch (error) {
      console.error('Failed to switch speaker:', error);
      toast.error('Failed to switch speaker');
    }
  }, [room]);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant) return;
    try {
      if (isAudioOnlyMode(qualityMode)) {
        toast.error(meetingRoomConfig.feedback.audioOnlyMessage);
        return;
      }
      const currentlyEnabled = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(
        !currentlyEnabled,
        !currentlyEnabled ? buildCameraCaptureOptions(activeCameraId || undefined, qualityMode, gridAspectRatio) : undefined,
      );
    } catch (error) {
      console.error('Failed to toggle camera:', error);
      toast.error('Failed to toggle camera');
    }
  }, [localParticipant, qualityMode, gridAspectRatio, activeCameraId]);

  const switchCamera = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice('videoinput', deviceId || 'default');
      setActiveCameraId(deviceId);
    } catch (error) {
      console.error('Failed to switch camera:', error);
      toast.error('Failed to switch camera');
    }
  }, [room]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    try {
      const currentlyEnabled = localParticipant.isScreenShareEnabled;
      const options = getScreenShareOptions(qualityMode, screenShareMode);
      await localParticipant.setScreenShareEnabled(
        !currentlyEnabled,
        currentlyEnabled ? { audio: false } : { audio: options.audio },
        currentlyEnabled ? undefined : { screenShareEncoding: options.encoding },
      );
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Screen share was cancelled or not supported.');
    }
  }, [localParticipant, qualityMode, screenShareMode]);

  const toggleHandRaise = useCallback(async () => {
    if (!room || !localParticipant) return;
    const payload = {
      type: handRaised ? 'lower_hand' : 'raise_hand',
      identity: localParticipant.identity,
    };
    await localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify(payload)),
      { reliable: true }
    );
    if (handRaised) {
      lowerHand(localParticipant.identity);
    } else {
      raiseHand(localParticipant.identity);
    }
  }, [room, localParticipant, handRaised, raiseHand, lowerHand]);

  // Recording - Disabled for now
  // const handleRecordingClick = useCallback(() => {
  //   if (!isModerator || !roomName) return;
  //   setShowRecordingConfirm(true);
  // }, [isModerator, roomName]);

  // const confirmStartRecording = useCallback(async () => {
  //   if (!roomName) return;
  //   setShowRecordingConfirm(false);
  //   setRecordingLoading(true);
  //   try {
  //     const response = await roomsApi.startRecording(roomName);
  //     setRecording(true, response.data.egressId || undefined);
  //     toast.success('Recording started');
  //   } catch (error) {
  //     console.error('Failed to start recording:', error);
  //     toast.error('Failed to start recording');
  //   } finally {
  //     setRecordingLoading(false);
  //   }
  // }, [roomName, setRecording]);

  // const confirmStopRecording = useCallback(async () => {
  //   if (!roomName) return;
  //   setShowRecordingConfirm(false);
  //   setRecordingLoading(true);
  //   try {
  //     await roomsApi.stopRecording(roomName);
  //     setRecording(false);
  //     toast.success('Recording stopped');
  //   } catch (error) {
  //     console.error('Failed to stop recording:', error);
  //     toast.error('Failed to stop recording');
  //   } finally {
  //     setRecordingLoading(false);
  //   }
  // }, [roomName, setRecording]);

  // const cancelRecordingAction = useCallback(() => {
  //   setShowRecordingConfirm(false);
  // }, []);

  // Just leave the meeting (doesn't end it for everyone)
  const leaveRoom = useCallback(async () => {
    if (!room || !localParticipant) return;

    const roomName = room.name;
    const connectedAt = (room as any).connectedAt || new Date();
    const duration = Math.round((Date.now() - new Date(connectedAt).getTime()) / 60000);

    // Stop local tracks
    try {
      if (localParticipant.isScreenShareEnabled) await localParticipant.setScreenShareEnabled(false);
      if (localParticipant.isCameraEnabled) await localParticipant.setCameraEnabled(false);
      if (localParticipant.isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      console.error('Failed to stop local media before disconnect:', error);
    } finally {
      await room.disconnect();
      reset();
      navigate('/thank-you', { state: { roomName, duration: duration > 0 ? duration : undefined } });
    }
  }, [room, localParticipant, navigate, reset]);

  // End meeting for everyone (moderators only)
  const endMeeting = useCallback(async () => {
    if (!room || !localParticipant) return;

    const roomName = room.name;
    const connectedAt = (room as any).connectedAt || new Date();
    const duration = Math.round((Date.now() - new Date(connectedAt).getTime()) / 60000);

    // Notify all participants that meeting is ending
    try {
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'meeting_ended',
        message: 'Host ended the meeting',
        reason: 'host_left',
      }));
      await room.localParticipant.publishData(message, { reliable: true, topic: 'meeting_ended' });
    } catch (error) {
      console.error('Failed to send meeting_ended message:', error);
    }

    // End meeting on backend
    try {
      await roomsApi.endMeeting(roomName);
    } catch (error) {
      console.error('Failed to end meeting on backend:', error);
    }

    // Stop local tracks
    try {
      if (localParticipant.isScreenShareEnabled) await localParticipant.setScreenShareEnabled(false);
      if (localParticipant.isCameraEnabled) await localParticipant.setCameraEnabled(false);
      if (localParticipant.isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      console.error('Failed to stop local media before disconnect:', error);
    } finally {
      await room.disconnect();
      reset();
      navigate('/thank-you', { state: { roomName, duration: duration > 0 ? duration : undefined } });
    }
  }, [room, localParticipant, navigate, reset]);

  const copyRoomLink = useCallback(async () => {
    if (!room?.name) return;
    const joinUrl = `${window.location.origin}/join/${room.name}`;
    try {
      await navigator.clipboard.writeText(joinUrl);
      toast.success('Meeting link copied');
    } catch (error) {
      console.error('Failed to copy meeting link:', error);
      toast.error('Failed to copy meeting link');
    }
  }, [room]);

  const toggleLayout = useCallback(() => {
    setLayout(layout === 'grid' ? 'speaker' : 'grid');
  }, [layout, setLayout]);

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
        if (isModerator && lobbyCount > 0) {
          // Badge handled by ParticipantsButton
        }
      },
    },
    { icon: <Link2 size={16} />, label: 'Copy Link', onClick: copyRoomLink },
    ...(isModerator ? [
      { icon: meetingLocked ? <Lock size={16} className="text-warning-400" /> : <Unlock size={16} />, label: meetingLocked ? 'Unlock Meeting' : 'Lock Meeting', onClick: () => setMeetingLocked(!meetingLocked) },
      { icon: <DoorOpen size={16} />, label: lobbyEnabled ? 'Disable Lobby' : 'Enable Lobby', onClick: () => setLobbyEnabled(!lobbyEnabled) },
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
            onToggle={toggleMic}
            showDeviceMenu={meetingRoomConfig.features.micDropdownDeviceMenu}
            mics={mics}
            speakers={speakers}
            activeMicId={activeMicId}
            activeSpeakerId={activeSpeakerId}
            onSwitchMic={switchMic}
            onSwitchSpeaker={switchSpeaker}
          />
          <CameraButton
            isOff={isCameraOff}
            onToggle={toggleCamera}
            showDeviceMenu={meetingRoomConfig.features.cameraDropdownDeviceMenu}
            cameras={cameras}
            activeCameraId={activeCameraId}
            onSwitchCamera={switchCamera}
          />
          <ScreenShareButton isSharing={isScreenSharing} onToggle={toggleScreenShare} />
        </div>

        <div className="w-px h-10 bg-surface-600 mx-2" />

        {/* Secondary Controls Group */}
        <div className="flex items-center gap-2">
          {/* Recording - Disabled for now */}
          {/* {isModerator && (
            <RecordingButton
              isRecording={isRecording}
              isLoading={recordingLoading}
              onToggle={handleRecordingClick}
            />
          )} */}
          <HandButton isRaised={handRaised} onToggle={toggleHandRaise} />
          <LayoutButton layout={layout} onToggle={toggleLayout} />
        </div>

        <div className="w-px h-10 bg-surface-600 mx-2" />

        {/* Communication Controls Group */}
        <div className="flex items-center gap-2">
          <ChatButton isOpen={chatOpen} unreadCount={unreadCount} mentionCount={mentionCount} onToggle={toggleChat} />
          <ParticipantsButton isOpen={participantsOpen} lobbyCount={lobbyCount} isModerator={isModerator} onToggle={toggleParticipants} />

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
                onToggleLock={() => setMeetingLocked(!meetingLocked)}
                onToggleLobby={() => setLobbyEnabled(!lobbyEnabled)}
                onToggleScreenShare={() => setParticipantsCanShareScreen(!participantsCanShareScreen)}
                onToggleChat={() => setParticipantsCanChat(!participantsCanChat)}
                onToggleUnmute={() => setParticipantsCanUnmute(!participantsCanUnmute)}
                onToggleCamera={() => setParticipantsCanTurnOnCamera(!participantsCanTurnOnCamera)}
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

      {/* Recording Confirmation Modal - Disabled for now */}
      {/* {showRecordingConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-800 rounded-2xl p-6 max-w-sm w-full mx-4 border border-surface-700 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                isRecording ? 'bg-surface-700' : 'bg-danger-500/20'
              )}>
                <div className={cn(
                  'rounded-full',
                  isRecording ? 'w-4 h-4 bg-surface-400' : 'w-3 h-3 bg-danger-500 animate-pulse'
                )} />
              </div>
              <h3 className="text-lg font-semibold text-surface-100">
                {isRecording ? 'Stop Recording?' : 'Start Recording?'}
              </h3>
            </div>
            <p className="text-surface-400 text-sm mb-6">
              {isRecording
                ? 'The recording will be stopped and saved. Participants will be notified.'
                : 'The meeting will be recorded. All participants will be notified that recording is in progress.'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={cancelRecordingAction}
                className="flex-1 py-2.5 px-4 rounded-xl bg-surface-700 hover:bg-surface-600 text-surface-200 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={isRecording ? confirmStopRecording : confirmStartRecording}
                disabled={recordingLoading}
                className={cn(
                  'flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2',
                  isRecording
                    ? 'bg-surface-700 hover:bg-surface-600 text-surface-200'
                    : 'bg-danger-500 hover:bg-danger-600 text-white'
                )}
              >
                {recordingLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <div className={cn('w-2 h-2 rounded-full', isRecording ? 'bg-surface-400' : 'bg-white')} />
                    {isRecording ? 'Stop' : 'Start'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )} */}

      {/* Recording Badge - Disabled for now */}
      {/* {isRecording && <RecordingBadge isRecording={isRecording} />} */}

      {/* Mobile Layout */}
      <div className="md:hidden flex items-center justify-between bg-surface-800/95 backdrop-blur-sm border-t border-surface-700 py-2 px-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {/* Left: Primary Controls */}
        <div className="flex items-center gap-1.5">
          <MobileMicButton isMuted={isMicMuted} onToggle={toggleMic} />
          <MobileCameraButton isOff={isCameraOff} onToggle={toggleCamera} />
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
          {/* Mobile Recording - Disabled for now */}
          {/* {isModerator && (
            <MobileRecordingButton
              isRecording={isRecording}
              isLoading={recordingLoading}
              onToggle={handleRecordingClick}
            />
          )} */}
          <MobileChatButton isOpen={chatOpen} unreadCount={unreadCount} mentionCount={mentionCount} onToggle={toggleChat} />
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
