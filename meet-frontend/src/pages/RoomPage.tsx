import { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { LiveKitRoom, useLocalParticipant, useRoomContext, useConnectionState } from '@livekit/components-react';
import { VideoPreset, Track } from 'livekit-client';
import { ConferenceRoom } from '../components/room/ConferenceRoom';
import { LobbyWaiting } from '../components/room/LobbyWaiting';
import { useConnectionActions, useQualityMode, useScreenShareMode, useUIActions, useRoomStore, useGridAspectRatio } from '../store/roomStore';
import { enableBlur } from '../utils/blurProcessorManager';
import { getRoomSettings, roomsApi } from '../services/api';
import {
  buildAudioCaptureOptions,
  buildCameraCaptureOptions,
  getAdaptiveStreamOptions,
  getQualityModeConfig,
  getScreenShareOptions,
  getVideoSimulcastLayers,
  isAudioOnlyMode,
  meetingRoomConfig,
  resolveAudioPreset,
  resolveBackupCodecPolicy,
  type QualityModeName,
  type ScreenShareModeName,
  type CameraHardwareCaps,
} from '../config/meetingRoomConfig';
import { Video, WifiOff } from 'lucide-react';
import '@livekit/components-styles';

interface LocationState {
  token: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  selectedCamera?: string;
  selectedMic?: string;
  selectedSpeaker?: string;
  micLevel?: number;
  speakerLevel?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  backgroundBlur?: boolean;
  videoFilter?: 'none' | 'lightweight';
  inLobby?: boolean;
  hostId?: string;
  role?: string;
  qualityMode?: QualityModeName;
  screenShareMode?: ScreenShareModeName;
  gridAspectRatio?: '16:9' | '9:16' | '1:1' | '4:3';
  videoFitMode?: 'cover' | 'contain';
  cameraHardwareCaps?: CameraHardwareCaps | null;
  displayName?: string;
}

// TrackSource enum values from LiveKit protocol
const TRACK_SOURCE = {
  UNKNOWN: 0,
  CAMERA: 1,
  MICROPHONE: 2,
  SCREEN_SHARE: 3,
  SCREEN_SHARE_AUDIO: 4,
} as const;

function sourceAllowed(sources: readonly unknown[] | undefined, source: string): boolean {
  if (!sources || sources.length === 0) {
    return true; // No restrictions = all sources allowed
  }

  // Map source name to TrackSource enum value
  const sourceMap: Record<string, number> = {
    camera: TRACK_SOURCE.CAMERA,
    microphone: TRACK_SOURCE.MICROPHONE,
    screen_share: TRACK_SOURCE.SCREEN_SHARE,
    screen_share_audio: TRACK_SOURCE.SCREEN_SHARE_AUDIO,
  };

  const targetValue = sourceMap[source.toLowerCase()];
  if (targetValue === undefined) {
    return true; // Unknown source = allow
  }

  // Check if the numeric TrackSource value is in the sources array
  return sources.some((value) => Number(value) === targetValue);
}

async function teardownRoomMedia(room: ReturnType<typeof useRoomContext>) {
  try {
    // room.disconnect() handles all track cleanup internally
    // No need to manually stop tracks - this avoids duplicate stops
    await room.disconnect();
  } catch (error) {
    console.error('[RoomPage] Failed to disconnect room during teardown:', error);
  }
}

// Helper function for permission checking
export function shouldDisableSource(
  localParticipant: ReturnType<typeof useRoomContext>['localParticipant'],
  source: string,
): boolean {
  const allowedSources = localParticipant.permissions?.canPublishSources;
  const isEnabledMap: Record<string, boolean> = {
    camera: localParticipant.isCameraEnabled,
    microphone: localParticipant.isMicrophoneEnabled,
    screen_share: localParticipant.isScreenShareEnabled,
  };
  return !sourceAllowed(allowedSources, source) && (isEnabledMap[source] ?? false);
}

// Reconnection overlay component
function ReconnectionOverlay({ isReconnecting }: { isReconnecting: boolean }) {
  if (!isReconnecting) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-800 rounded-xl p-6 flex flex-col items-center gap-4">
        <WifiOff className="w-12 h-12 text-yellow-400 animate-pulse" />
        <div className="text-white font-medium">Reconnecting...</div>
        <div className="text-surface-400 text-sm">Please wait while we restore your connection</div>
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    </div>
  );
}

function RoomContent({
  roomName,
  state,
  qualityMode,
}: {
  roomName?: string;
  state: LocationState;
  qualityMode?: QualityModeName;
}) {
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  const connectionState = useConnectionState();
  const { setToken, setHostId, setRole, setDisplayName } = useConnectionActions();
  
  // Get current grid aspect ratio from store for camera options
  const currentGridAspectRatio = useGridAspectRatio();
  
  const [inLobby, setInLobby] = useState(state.inLobby || false);
  const [isConnecting, setIsConnecting] = useState(true);
  const hasTeardownRunRef = useRef(false);
  const teardownArmedRef = useRef(false);
  
  // Reconnection state
  const [isReconnecting, setIsReconnecting] = useState(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monitor connection state for reconnection
  useEffect(() => {
    if (connectionState === 'reconnecting') {
      console.log('[RoomPage] Connection state: reconnecting');
      setIsReconnecting(true);
    } else if (connectionState === 'connected') {
      console.log('[RoomPage] Connection state: connected');
      setIsReconnecting(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    } else if (connectionState === 'disconnected') {
      console.log('[RoomPage] Connection state: disconnected');
      // Give LiveKit time to attempt reconnection before showing permanent disconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[RoomPage] Reconnection timeout, staying disconnected');
      }, 30000); // 30 second grace period
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectionState]);

  // Apply background blur when camera is enabled (using blur manager)
  useEffect(() => {
    if (!state.backgroundBlur || !localParticipant.isCameraEnabled) return;

    let cancelled = false;

    const applyBlur = async () => {
      const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
      const cameraTrack = cameraPublication?.track;
      if (cameraTrack && 'setProcessor' in cameraTrack) {
        if (cancelled) return;
        const success = await enableBlur(cameraTrack as Parameters<typeof enableBlur>[0]);
        if (!cancelled) {
          console.log(`[RoomPage] Background blur ${success ? 'applied' : 'failed'}`);
        }
      }
    };

    // Small delay to ensure track is ready
    const timer = setTimeout(() => { void applyBlur(); }, 100);
    
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [state.backgroundBlur, localParticipant, localParticipant.isCameraEnabled]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[RoomPage] State received:', { 
        role: state.role, 
        hostId: state.hostId, 
        identity: localParticipant.identity,
        videoEnabled: state.videoEnabled,
        audioEnabled: state.audioEnabled,
        displayName: state.displayName,
      });
    }
    if (localParticipant.identity) {
      setToken(state.token, localParticipant.identity, state.role || 'attendee');
    }
    if (state.hostId) {
      setHostId(state.hostId);
    }
    if (state.role) {
      setRole(state.role);
    }
    if (state.displayName) {
      setDisplayName(state.displayName);
    }
  }, [localParticipant.identity, state.token, state.hostId, state.role, state.displayName, state.videoEnabled, state.audioEnabled, setToken, setHostId, setRole, setDisplayName]);

  useEffect(() => {
    if (!room) return;

    const deviceId = state.selectedSpeaker || 'default';
    void room.switchActiveDevice('audiooutput', deviceId).catch((error) => {
      console.error('[RoomPage] Failed to switch speaker device:', error);
    });
  }, [room, state.selectedSpeaker]);

  useEffect(() => {
    const volume = Math.max(0, Math.min(1, (state.speakerLevel ?? 100) / 100));

    const applyVolume = () => {
      document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((element) => {
        if (!element.muted) {
          element.volume = volume;
        }
      });
    };

    applyVolume();
  }, [state.speakerLevel]);

  useEffect(() => {
    if (!isAudioOnlyMode(qualityMode) || !localParticipant.isCameraEnabled) {
      return;
    }

    void localParticipant.setCameraEnabled(false).catch((error) => {
      console.error('[RoomPage] Failed to disable camera for audio-only mode:', error);
    });
  }, [qualityMode, localParticipant]);

  // Reconfigure camera when quality mode changes (e.g., highQuality -> dataSaver)
  useEffect(() => {
    // Skip if camera is not enabled or we're in audio-only mode (handled above)
    if (!localParticipant.isCameraEnabled || isAudioOnlyMode(qualityMode)) {
      return;
    }

    // Reconfigure camera with new quality settings
    const reconfigureCamera = async () => {
      try {
        const cameraTrack = localParticipant.getTrackPublication(Track.Source.Camera);
        if (cameraTrack?.track) {
          const newOptions = buildCameraCaptureOptions(state.selectedCamera, qualityMode, currentGridAspectRatio, state.cameraHardwareCaps);
          await localParticipant.setCameraEnabled(true, newOptions);
          console.log(`[RoomPage] Camera reconfigured for quality mode: ${qualityMode}`);
        }
      } catch (error) {
        console.error('[RoomPage] Failed to reconfigure camera for quality mode:', error);
      }
    };

    reconfigureCamera();
  }, [qualityMode, localParticipant, state.selectedCamera, state.cameraHardwareCaps, currentGridAspectRatio]);

  useEffect(() => {
    const permission = localParticipant.permissions;
    if (!permission) return;

    if (shouldDisableSource(localParticipant, 'camera')) {
      void localParticipant.setCameraEnabled(false).catch((error) => {
        console.error('[RoomPage] Failed to enforce camera disable from permissions:', error);
      });
    }

    if (shouldDisableSource(localParticipant, 'microphone')) {
      void localParticipant.setMicrophoneEnabled(false).catch((error) => {
        console.error('[RoomPage] Failed to enforce microphone mute from permissions:', error);
      });
    }

    if (shouldDisableSource(localParticipant, 'screen_share')) {
      void localParticipant.setScreenShareEnabled(false).catch((error) => {
        console.error('[RoomPage] Failed to enforce screen share disable from permissions:', error);
      });
    }
  }, [
    localParticipant,
    localParticipant.permissions,
    localParticipant.permissions?.canPublishSources,
    localParticipant.isCameraEnabled,
    localParticipant.isMicrophoneEnabled,
    localParticipant.isScreenShareEnabled,
  ]);

  useEffect(() => {
    const checkLobbyStatus = () => {
      const permissions = localParticipant.permissions;
      console.log('[RoomPage] Checking lobby status:', {
        initialInLobby: state.inLobby,
        permissions,
        canPublish: permissions?.canPublish
      });
      
      // CRITICAL: Trust the server's inLobby decision from token generation
      // The ONLY way to exit lobby is when moderator explicitly grants canPublish permission
      if (state.inLobby === true) {
        // Server said this user should be in lobby
        // Check if they've been admitted (have explicit canPublish: true)
        if (permissions?.canPublish === true) {
          // Moderator has admitted them - they now have publish permission
          console.log('[RoomPage] Guest admitted by moderator - exiting lobby');
          setInLobby(false);
        } else {
          // Still in lobby - no publish permission yet
          console.log('[RoomPage] Guest in lobby - waiting for moderator');
          setInLobby(true);
        }
      } else {
        // Server didn't set inLobby - authenticated user, not in lobby
        setInLobby(false);
      }
      setIsConnecting(false);
    };

    const timer = setTimeout(checkLobbyStatus, 500);
    return () => clearTimeout(timer);
  }, [localParticipant.permissions, state.inLobby]);

  useEffect(() => {
    const handlePermissionChange = () => {
      const permissions = localParticipant.permissions;
      console.log('[RoomPage] Permission changed event:', {
        canPublish: permissions?.canPublish,
        currentInLobby: inLobby,
        initialInLobby: state.inLobby
      });
      
      // Only process permission changes if user was initially in lobby
      if (state.inLobby === true && permissions?.canPublish === true && inLobby) {
        console.log('[RoomPage] Guest admitted from lobby by moderator');
        setInLobby(false);
      }
    };

    localParticipant.on('participantPermissionsChanged', handlePermissionChange);
    return () => {
      localParticipant.off('participantPermissionsChanged', handlePermissionChange);
    };
  }, [localParticipant, inLobby, state.inLobby]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      teardownArmedRef.current = true;
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (!teardownArmedRef.current) {
        return;
      }
      if (hasTeardownRunRef.current) {
        return;
      }
      hasTeardownRunRef.current = true;
      void teardownRoomMedia(room);
    };
  }, [room]);

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Video className="w-8 h-8 text-white" />
          </div>
          <div className="w-10 h-10 border-2 border-brand-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-surface-800 dark:text-white font-medium">Connecting to room...</div>
          <div className="text-surface-500 dark:text-surface-400 text-sm mt-1">Please wait</div>
        </div>
      </div>
    );
  }

  if (inLobby) {
    return <LobbyWaiting roomName={roomName} />;
  }

  return (
    <>
      <ReconnectionOverlay isReconnecting={isReconnecting} />
      <ConferenceRoom roomName={roomName} />
    </>
  );
}

export default function RoomPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { setConnected } = useConnectionActions();
  const { setQualityMode, setScreenShareMode } = useUIActions();
  const qualityMode = useQualityMode();
  const screenShareMode = useScreenShareMode();
  
  // Check for token in location state OR in sessionStorage (for teacher links from external apps)
  const stateFromLocation = location.state as LocationState | null;
  const tokenFromSession = roomName ? sessionStorage.getItem(`token_${roomName}`) : null;
  const roleFromSession = roomName ? sessionStorage.getItem(`role_${roomName}`) : null;
  // Use useMemo to ensure consistent hook call order
  const state = useMemo<LocationState | null>(() => {
    if (tokenFromSession) {
      const role = roleFromSession || stateFromLocation?.role || 'attendee';
      return { token: tokenFromSession, videoEnabled: true, audioEnabled: true, role };
    }
    return stateFromLocation;
  }, [tokenFromSession, roleFromSession, stateFromLocation]);
  
  // Grid aspect ratio & video fit mode - get from store for camera options
  const { setGridAspectRatio, setVideoFitMode } = useRoomStore();
  const currentGridAspectRatio = useGridAspectRatio();
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    if (!state?.token && !hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      navigate(`/join/${roomName}`);
    }
    // Clear sessionStorage token after using it (for teacher links from external apps)
    if (state?.token && roomName && tokenFromSession) {
      sessionStorage.removeItem(`token_${roomName}`);
      sessionStorage.removeItem(`role_${roomName}`);
    }
  }, [state, roomName, navigate, tokenFromSession]);

  useEffect(() => {
    if (state?.qualityMode) {
      setQualityMode(state.qualityMode);
    }
    if (state?.screenShareMode) {
      setScreenShareMode(state.screenShareMode);
    }
  }, [state?.qualityMode, state?.screenShareMode, setQualityMode, setScreenShareMode]);

  // Sync grid aspect ratio from PreJoinPage to store
  useEffect(() => {
    if (state?.gridAspectRatio) {
      setGridAspectRatio(state.gridAspectRatio);
    }
  }, [state?.gridAspectRatio, setGridAspectRatio]);

  // Sync video fit mode from PreJoinPage to store
  useEffect(() => {
    if (state?.videoFitMode) {
      setVideoFitMode(state.videoFitMode);
    }
  }, [state?.videoFitMode, setVideoFitMode]);

  // Fetch room settings from server (moderator's saved settings)
  useEffect(() => {
    if (!roomName) return;
    let cancelled = false;
    
    const fetchSettings = async () => {
      try {
        const response = await getRoomSettings(roomName);
        if (cancelled) return;
        
        const settings = response.data.settings;
        
        // Apply server settings to store (only if not already set from state)
        if (settings.gridAspectRatio && !state?.gridAspectRatio) {
          setGridAspectRatio(settings.gridAspectRatio as '16:9' | '9:16' | '1:1' | '4:3');
        }
        if (settings.videoFitMode && !state?.videoFitMode) {
          setVideoFitMode(settings.videoFitMode as 'cover' | 'contain');
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('[RoomPage] Could not fetch room settings:', error);
        }
      }
    };
    
    void fetchSettings();
    return () => { cancelled = true; };
  }, [roomName, state?.gridAspectRatio, state?.videoFitMode, setGridAspectRatio, setVideoFitMode]);

  // Compute derived values needed for LiveKit options - always compute to satisfy ESLint
  const effectiveQualityMode = qualityMode || state?.qualityMode || getQualityModeConfig().name;
  const effectiveScreenShareMode = screenShareMode || state?.screenShareMode || meetingRoomConfig.media.screenShare.defaultMode;
  const screenShareOptions = getScreenShareOptions(effectiveQualityMode, effectiveScreenShareMode);
  const qualitySettings = getQualityModeConfig(effectiveQualityMode);
  const audioOnlyMode = isAudioOnlyMode(effectiveQualityMode);

  // Dynamic resolution based on call size (will be updated by hooks inside room)
  // For initial connection, use default settings
  const maxBitrate = qualitySettings.name === 'highQuality'
    ? meetingRoomConfig.media.simulcastLayers.high.maxBitrate
    : meetingRoomConfig.media.publishDefaults.videoEncoding.maxBitrate;

  // Capture video at the target aspect ratio to save bandwidth
  const videoOptions = state?.token && state.videoEnabled && !audioOnlyMode
    ? buildCameraCaptureOptions(state.selectedCamera, effectiveQualityMode, currentGridAspectRatio, state.cameraHardwareCaps)
    : false;
  
  const audioOptions = state?.token && state.audioEnabled
    ? buildAudioCaptureOptions(
        state.selectedMic,
        state.noiseSuppression,
        state.echoCancellation,
        state.micLevel,
      )
    : false;

  const livekitOptions = useMemo(() => ({
    adaptiveStream: getAdaptiveStreamOptions(),
    dynacast: meetingRoomConfig.room.dynacast,
    stopLocalTrackOnUnpublish: true,
    disconnectOnPageLeave: true,
    audioCaptureDefaults: buildAudioCaptureOptions(
      undefined,
      meetingRoomConfig.prejoin.noiseSuppression,
      meetingRoomConfig.prejoin.echoCancellation,
      state?.micLevel,
    ),
    videoCaptureDefaults: buildCameraCaptureOptions(undefined, effectiveQualityMode, currentGridAspectRatio, state?.cameraHardwareCaps),
    publishDefaults: {
      simulcast: meetingRoomConfig.media.publishDefaults.simulcast,
      videoCodec: meetingRoomConfig.media.publishDefaults.videoCodec,
      backupCodec: meetingRoomConfig.media.publishDefaults.backupCodec,
      backupCodecPolicy: resolveBackupCodecPolicy(),
      audioPreset: resolveAudioPreset(effectiveQualityMode),
      dtx: meetingRoomConfig.media.publishDefaults.dtx,
      red: meetingRoomConfig.media.publishDefaults.red,
      forceStereo: meetingRoomConfig.media.publishDefaults.forceStereo,
      scalabilityMode: meetingRoomConfig.media.publishDefaults.scalabilityMode as
        'L1T1' | 'L1T2' | 'L1T3' | 'L2T1' | 'L2T1h' | 'L2T1_KEY' | 'L2T2' | 'L2T2h' | 'L2T2_KEY' | 'L2T3' | 'L2T3h' | 'L2T3_KEY' | 'L3T1' | 'L3T1h' | 'L3T1_KEY' | 'L3T2' | 'L3T2h' | 'L3T2_KEY' | 'L3T3' | 'L3T3h' | 'L3T3_KEY',
      degradationPreference: meetingRoomConfig.media.publishDefaults.degradationPreference,
      videoEncoding: {
        maxBitrate: maxBitrate,
        maxFramerate: qualitySettings.settings.cameraMaxFrameRate ?? meetingRoomConfig.media.publishDefaults.videoEncoding.maxFramerate,
      },
      screenShareEncoding: {
        maxBitrate: screenShareOptions.encoding.maxBitrate,
        maxFramerate: screenShareOptions.encoding.maxFramerate,
      },
      videoSimulcastLayers: getVideoSimulcastLayers(effectiveQualityMode),
      screenShareSimulcastLayers: [
        new VideoPreset(
          screenShareOptions.resolution.width,
          screenShareOptions.resolution.height,
          screenShareOptions.encoding.maxBitrate,
          screenShareOptions.encoding.maxFramerate,
        ),
      ],
    },
  }), [
    effectiveQualityMode, currentGridAspectRatio, state?.micLevel, state?.cameraHardwareCaps,
    maxBitrate, qualitySettings, screenShareOptions,
  ]);

  if (!state?.token) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-2 border-brand-400 border-t-transparent rounded-full animate-spin"></div>
        <div className="text-surface-500 dark:text-surface-400 mt-4">Redirecting to join page...</div>
      </div>
    );
  }

  const handleConnected = () => {
    setConnected(true);
    
    // Register meeting in history for moderators
    if (state.role === 'moderator' && roomName) {
      roomsApi.startMeeting(roomName).catch((error) => {
        console.warn('[RoomPage] Failed to register meeting in history:', error);
      });
    }
    
    if (import.meta.env.DEV) {
      console.log('✅ Connected to room:', roomName);
      console.log('Initial state - Video:', state.videoEnabled, 'Audio:', state.audioEnabled);
    }
  };

  const handleDisconnected = () => {
    console.log('[RoomPage] Disconnected from room');
  };

  const handleError = (error: Error) => {
    if (import.meta.env.DEV) {
      console.error('❌ Room error:', error);
    }
  };

  if (import.meta.env.DEV) {
    console.log('🎬 LiveKitRoom options:', { 
      videoEnabled: state.videoEnabled, 
      audioEnabled: state.audioEnabled,
      videoOptions, 
      audioOptions, 
      url: import.meta.env.VITE_LIVEKIT_URL 
    });
  }

  return (
    <LiveKitRoom
      token={state.token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      video={videoOptions}
      audio={audioOptions}
      onConnected={handleConnected}
      onDisconnected={handleDisconnected}
      onError={handleError}
      connect={true}
      options={livekitOptions}
      style={{ height: '100dvh' }}
    >
      <RoomContent roomName={roomName} state={state} qualityMode={effectiveQualityMode} />
    </LiveKitRoom>
  );
}
