import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { LiveKitRoom, useLocalParticipant, useRoomContext, useConnectionState } from '@livekit/components-react';
import { VideoPreset, Track } from 'livekit-client';
import { ConferenceRoom } from '../components/room/ConferenceRoom';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LobbyWaiting } from '../components/room/LobbyWaiting';
import { useConnectionActions, useQualityMode, useScreenShareMode, useUIActions, useGridAspectRatio, useBackgroundBlurEnabled, useBackgroundBlurLevel } from '../store/roomStore';
import { enableBlur, disableBlur } from '../utils/blurProcessorManager';
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
import logger from '../utils/logger';

// Module-scoped constant — avoids new object per render
const FULLSCREEN_STYLE = { height: '100dvh' } as const;

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
  backgroundBlurLevel?: number;
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
    logger.error('[RoomPage] Failed to disconnect room during teardown:', error);
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
  const { setToken, setHostId, setRole, setDisplayName, setPrejoinDevices } = useConnectionActions();
  
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
      logger.info('[RoomPage] Connection state: reconnecting');
      setIsReconnecting(true);
    } else if (connectionState === 'connected') {
      logger.info('[RoomPage] Connection state: connected');
      setIsReconnecting(false);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    } else if (connectionState === 'disconnected') {
      logger.info('[RoomPage] Connection state: disconnected');
      // Give LiveKit time to attempt reconnection before showing permanent disconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        logger.info('[RoomPage] Reconnection timeout, staying disconnected');
      }, 30000); // 30 second grace period
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connectionState]);

  const storeBlurEnabled = useBackgroundBlurEnabled();
  const backgroundBlurLevel = useBackgroundBlurLevel();

  useEffect(() => {
    const blurEnabled = storeBlurEnabled || state.backgroundBlur;
    if (!blurEnabled || !localParticipant.isCameraEnabled) {
      if (!blurEnabled && localParticipant.isCameraEnabled) {
        const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
        const cameraTrack = cameraPublication?.track;
        if (cameraTrack && 'setProcessor' in cameraTrack) {
          void disableBlur(cameraTrack as Parameters<typeof disableBlur>[0]);
        }
      }
      return;
    }

    let cancelled = false;

    const applyBlur = async () => {
      const cameraPublication = localParticipant.getTrackPublication(Track.Source.Camera);
      const cameraTrack = cameraPublication?.track;
      if (cameraTrack && 'setProcessor' in cameraTrack) {
        if (cancelled) return;
          const success = await enableBlur(cameraTrack as Parameters<typeof enableBlur>[0], undefined, backgroundBlurLevel);
        if (!cancelled) {
          logger.info(`[RoomPage] Background blur ${success ? 'applied' : 'failed'}`);
        }
      }
    };

    const timer = setTimeout(() => { void applyBlur(); }, 100);
    
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [storeBlurEnabled, state.backgroundBlur, localParticipant, localParticipant.isCameraEnabled, localParticipant.getTrackPublication(Track.Source.Camera)?.track, backgroundBlurLevel]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.info('[RoomPage] State received:', { 
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
    if (state.selectedCamera || state.selectedMic) {
      setPrejoinDevices(state.selectedCamera || null, state.selectedMic || null);
    }
  }, [localParticipant.identity, state.token, state.hostId, state.role, state.displayName, state.selectedCamera, state.selectedMic, setToken, setHostId, setRole, setDisplayName, setPrejoinDevices]);

  // Switch audio output (speaker) to prejoin selection
  useEffect(() => {
    if (!room) return;

    const deviceId = state.selectedSpeaker || 'default';
    void room.switchActiveDevice('audiooutput', deviceId).catch((error) => {
      logger.error('[RoomPage] Failed to switch speaker device:', error);
    });
  }, [room, state.selectedSpeaker]);

  // Switch video input (camera) to prejoin selection
  useEffect(() => {
    if (!room || !state.selectedCamera) return;

    void room.switchActiveDevice('videoinput', state.selectedCamera).catch((error) => {
      logger.error('[RoomPage] Failed to switch camera device:', error);
    });
  }, [room, state.selectedCamera]);

  // Switch audio input (microphone) to prejoin selection
  useEffect(() => {
    if (!room || !state.selectedMic) return;

    void room.switchActiveDevice('audioinput', state.selectedMic).catch((error) => {
      logger.error('[RoomPage] Failed to switch microphone device:', error);
    });
  }, [room, state.selectedMic]);

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

  // Track whether camera was on before audioOnly kicked in
  const cameraWasOnBeforeAudioOnly = useRef(false);
  const localParticipantRef = useRef(localParticipant);
  localParticipantRef.current = localParticipant;

  useEffect(() => {
    const lp = localParticipantRef.current;
    const audioOnly = isAudioOnlyMode(qualityMode);

    if (audioOnly) {
      if (lp.isCameraEnabled) {
        cameraWasOnBeforeAudioOnly.current = true;
      }
      void lp.setCameraEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to disable camera for audio-only mode:', error);
      });
    } else if (cameraWasOnBeforeAudioOnly.current) {
      cameraWasOnBeforeAudioOnly.current = false;
      void lp.setCameraEnabled(true).catch((error) => {
        logger.error('[RoomPage] Failed to re-enable camera after audio-only recovery:', error);
      });
    }
  }, [qualityMode]);

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
          logger.info(`[RoomPage] Camera reconfigured for quality mode: ${qualityMode}`);
        }
      } catch (error) {
        logger.error('[RoomPage] Failed to reconfigure camera for quality mode:', error);
      }
    };

    reconfigureCamera();
  }, [qualityMode, localParticipant, state.selectedCamera, state.cameraHardwareCaps, currentGridAspectRatio]);

  // Permission enforcer — only react to actual permission changes, not track state changes.
  // Using refs avoids re-running when localParticipant reference changes due to unrelated
  // LiveKit events (stats, track updates) which caused camera/mic to be disabled spuriously.
  const permissionEnforcerRef = useRef(localParticipant);
  permissionEnforcerRef.current = localParticipant;
  const canPublishSources = localParticipant.permissions?.canPublishSources;
  const canPublishSourcesKey = canPublishSources ? canPublishSources.join(',') : '';

  useEffect(() => {
    const lp = permissionEnforcerRef.current;
    const permission = lp.permissions;
    if (!permission) return;

    if (shouldDisableSource(lp, 'camera')) {
      void lp.setCameraEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to enforce camera disable from permissions:', error);
      });
    }

    if (shouldDisableSource(lp, 'microphone')) {
      void lp.setMicrophoneEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to enforce microphone mute from permissions:', error);
      });
    }

    if (shouldDisableSource(lp, 'screen_share')) {
      void lp.setScreenShareEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to enforce screen share disable from permissions:', error);
      });
    }
  }, [canPublishSourcesKey]);

  useEffect(() => {
    const checkLobbyStatus = () => {
      const permissions = localParticipant.permissions;
      logger.info('[RoomPage] Checking lobby status:', {
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
          logger.info('[RoomPage] Guest admitted by moderator - exiting lobby');
          setInLobby(false);
        } else {
          // Still in lobby - no publish permission yet
          logger.info('[RoomPage] Guest in lobby - waiting for moderator');
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
      logger.info('[RoomPage] Permission changed event:', {
        canPublish: permissions?.canPublish,
        currentInLobby: inLobby,
        initialInLobby: state.inLobby
      });
      
      // Only process permission changes if user was initially in lobby
      if (state.inLobby === true && permissions?.canPublish === true && inLobby) {
        logger.info('[RoomPage] Guest admitted from lobby by moderator');
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
  const { setQualityMode, setScreenShareMode, setGridAspectRatio, setVideoFitMode, setBackgroundBlurEnabled, setBackgroundBlurLevel } = useUIActions();
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

  // Sync background blur from PreJoinPage to store
  useEffect(() => {
    setBackgroundBlurEnabled(!!state?.backgroundBlur);
  }, [state?.backgroundBlur, setBackgroundBlurEnabled]);

  useEffect(() => {
    if (typeof state?.backgroundBlurLevel === 'number') {
      setBackgroundBlurLevel(state.backgroundBlurLevel);
    }
  }, [state?.backgroundBlurLevel, setBackgroundBlurLevel]);

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
          logger.warn('[RoomPage] Could not fetch room settings:', error);
        }
      }
    };
    
    void fetchSettings();
    return () => { cancelled = true; };
  }, [roomName, state?.gridAspectRatio, state?.videoFitMode, setGridAspectRatio, setVideoFitMode]);

  // Compute derived values needed for LiveKit options - always compute to satisfy ESLint
  const effectiveQualityMode = state?.qualityMode || qualityMode || getQualityModeConfig().name;
  const effectiveScreenShareMode = state?.screenShareMode || screenShareMode || meetingRoomConfig.media.screenShare.defaultMode;
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

  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const livekitUrl = isLocalhost
    ? import.meta.env.VITE_LIVEKIT_URL
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/livekit`;
  const livekitOptions = useMemo(() => ({
    adaptiveStream: getAdaptiveStreamOptions(),
    dynacast: meetingRoomConfig.room.dynacast,
    stopLocalTrackOnUnpublish: true,
    disconnectOnPageLeave: true,
    ...(livekitUrl.includes('127.0.0.1') && {
      rtcConfig: {
        iceServers: [],
      },
    }),
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
    state?.videoEnabled, state?.audioEnabled, state?.selectedCamera, state?.selectedMic,
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

  const handleConnected = useCallback(() => {
    setConnected(true);
    
    // Register meeting in history for moderators
    if (state.role === 'moderator' && roomName) {
      roomsApi.startMeeting(roomName).catch((error) => {
        logger.warn('[RoomPage] Failed to register meeting in history:', error);
      });
    }
    
    if (import.meta.env.DEV) {
      logger.info('✅ Connected to room:', roomName);
      logger.info('Initial state - Video:', state.videoEnabled, 'Audio:', state.audioEnabled);
    }
  }, [state.role, state.videoEnabled, state.audioEnabled, roomName]);

  const handleDisconnected = useCallback(() => {
    logger.info('[RoomPage] Disconnected from room');
  }, []);

  const handleError = useCallback((error: Error) => {
    if (import.meta.env.DEV) {
      logger.error('❌ Room error:', error);
    }
  }, []);

  if (import.meta.env.DEV) {
    logger.info('🎬 LiveKitRoom options:', { 
      videoEnabled: state.videoEnabled, 
      audioEnabled: state.audioEnabled,
      videoOptions, 
      audioOptions, 
      url: livekitUrl 
    });
  }

  return (
    <ErrorBoundary>
      <LiveKitRoom
        token={state.token}
        serverUrl={livekitUrl}
        video={videoOptions}
        audio={audioOptions}
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
        onError={handleError}
        connect={true}
        options={livekitOptions}
        style={FULLSCREEN_STYLE}
      >
        <RoomContent roomName={roomName} state={state} qualityMode={effectiveQualityMode} />
      </LiveKitRoom>
    </ErrorBoundary>
  );
}
