import { AudioPresets, BackupCodecPolicy, VideoPreset, VideoQuality, type AudioCaptureOptions, type VideoCaptureOptions } from 'livekit-client';
import rawConfig from '../../meeting-room.config.example.jsonc?raw';
import logger from '../utils/logger';

type LayoutMode = 'speaker' | 'grid' | 'spotlight' | 'screenshare';
type VideoCodec = 'vp8' | 'h264' | 'vp9' | 'av1' | 'h265';
type AudioPresetName = 'telephone' | 'speech' | 'music' | 'musicStereo' | 'musicHighQuality' | 'musicHighQualityStereo';
type BackupCodecPolicyName = 'prefer_regression' | 'simulcast' | 'regression';
type DegradationPreference = 'balanced' | 'maintain-framerate' | 'maintain-resolution';
type ContentHint = 'detail' | 'text' | 'motion';
export type QualityModeName = 'auto' | 'dataSaver' | 'highQuality' | 'audioOnly';
export type ScreenShareModeName = 'documents' | 'motion';
export type SimulcastLayerName = keyof MeetingRoomConfig['media']['simulcastLayers'];

interface QualityModeConfig {
  cameraMaxResolution?: string;
  cameraMaxFrameRate?: number;
  screenShareMaxResolution?: string;
  screenShareMaxFrameRate?: number;
  audioBitrateKbps: number;
  cameraDisabled?: boolean;
  incomingVideoDisabled?: boolean;
}

interface LayerConfig {
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
}

export interface MeetingRoomConfig {
  app: {
    apiBaseUrl: string;
    livekitUrl: string;
  };
  room: {
    defaultLayout: LayoutMode;
    qualityMode: QualityModeName;
    adaptiveStream: boolean;
    dynacast: boolean;
    simulcast: boolean;
    pauseOffscreenVideo: boolean;
    joinLeaveSoundsEnabled: boolean;
    mirrorLocalVideo: boolean;
    showChatTimestamps: boolean;
    lobbyPollIntervalMs: number;
  };
  features: {
    fullscreenTileView: boolean;
    mirrorLocalVideoToggle: boolean;
    copyRoomLink: boolean;
    joinLeaveSoundToggle: boolean;
    participantSearch: boolean;
    inlineLobbyBanner: boolean;
    typingIndicator: boolean;
    privateMessagesToModerators: boolean;
    chatTimestampsToggle: boolean;
    deviceSwitchingInRoom: boolean;
    micDropdownDeviceMenu: boolean;
    cameraDropdownDeviceMenu: boolean;
    settingsPanelDeviceFallback: boolean;
    qualityModeSelector: boolean;
    connectionQualityIndicator: boolean;
    networkRecoveryToasts: boolean;
    screenshareModeSelector: boolean;
  };
  moderation: {
    muteParticipant: boolean;
    muteAllParticipants: boolean;
    disableParticipantCamera: boolean;
    disableAllParticipantCameras: boolean;
    disableParticipantScreenShare: boolean;
    kickParticipant: boolean;
    admitLobbyParticipant: boolean;
    denyLobbyParticipant: boolean;
    admitAllFromLobby: boolean;
    denyAllFromLobby: boolean;
    skipModeratorsForMuteAll: boolean;
    skipModeratorsForDisableAllCameras: boolean;
  };
  chat: {
    publicChatEnabled: boolean;
    persistPublicRoomChat: boolean;
    privateModeratorChatEnabled: boolean;
    persistPrivateModeratorChat: boolean;
    typingIndicatorTimeoutMs: number;
    maxHistoryMessages: number;
  };
  prejoin: {
    videoEnabledByDefault: boolean;
    audioEnabledByDefault: boolean;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    showDeviceSettingsByDefault: boolean;
    defaultAspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
    defaultVideoFitMode: 'cover' | 'contain';
  };
  videoEffects: {
    backgroundBlur: {
      enabled: boolean;
      defaultBlurRadius: number;
      debounceMs: number;
      lockTimeoutMs: number;
      implementation: string;
    };
    virtualBackground: {
      enabled: boolean;
    };
  };
  mediaSwitching: {
    cameraDeviceKind: 'videoinput';
    microphoneDeviceKind: 'audioinput';
    defaultCameraDeviceId: string;
    defaultMicrophoneDeviceId: string;
  };
  qualityModes: {
    defaultMode: QualityModeName;
    availableModes: QualityModeName[];
    auto: QualityModeConfig;
    dataSaver: QualityModeConfig;
    highQuality: QualityModeConfig;
    audioOnly: QualityModeConfig;
  };
  media: {
    cameraCapture: {
      width: number;
      height: number;
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
      frameRate: number;
      minFrameRate: number;
      maxFrameRate: number;
      facingMode: 'user' | 'environment' | 'left' | 'right';
    };
    audioCapture: {
      autoGainControl: boolean;
      echoCancellation: boolean;
      noiseSuppression: boolean;
      channelCount: number;
      latency: number;
      sampleRate: number;
      sampleSize: number;
    };
    publishDefaults: {
      videoCodec: VideoCodec;
      backupCodec: boolean;
      backupCodecPolicy: BackupCodecPolicyName;
      audioPreset: AudioPresetName;
      dtx: boolean;
      red: boolean;
      forceStereo: boolean;
      simulcast: boolean;
      scalabilityMode: string;
      degradationPreference: DegradationPreference;
      videoEncoding: {
        minBitrate: number;
        maxBitrate: number;
        minFramerate: number;
        maxFramerate: number;
      };
      screenShareEncoding: {
        minBitrate: number;
        maxBitrate: number;
        minFramerate: number;
        maxFramerate: number;
      };
    };
    simulcastLayers: {
      low: LayerConfig;
      medium: LayerConfig;
      high: LayerConfig;
      ultra: LayerConfig;
    };
    screenShare: {
      defaultMode: ScreenShareModeName;
      resolution: {
        width: number;
        height: number;
        minWidth: number;
        maxWidth: number;
        minHeight: number;
        maxHeight: number;
        frameRate: number;
        minFrameRate: number;
        maxFrameRate: number;
      };
      audio: boolean;
      contentHint: ContentHint;
      surfaceSwitching: 'include' | 'exclude';
      systemAudio: 'include' | 'exclude';
      selfBrowserSurface: 'include' | 'exclude';
      modes: Record<ScreenShareModeName, {
        width: number;
        height: number;
        frameRate: number;
        maxBitrate: number;
      }>;
    };
  };
  network: {
    prioritizeAudioOverVideo: boolean;
    degradeVideoFirstOnCongestion: boolean;
    packetLossWarningPercent: number;
    packetLossPoorPercent: number;
    rttWarningMs: number;
    rttPoorMs: number;
    jitterWarningMs: number;
    jitterPoorMs: number;
    availableBitrateWarningBps: number;
    availableBitrateGoodBps: number;
  };
  activeSpeaker: {
    promotionDelayMs: number;
    demotionDelayMs: number;
    pinnedParticipantTargetLayer: keyof MeetingRoomConfig['media']['simulcastLayers'];
    hostPresenterTargetLayer: keyof MeetingRoomConfig['media']['simulcastLayers'];
  };
  layoutQuality: {
    thumbnailMaxWidthPx: number;
    mediumTileMaxWidthPx: number;
    largeTileMaxWidthPx: number;
    thumbnailLayer: keyof MeetingRoomConfig['media']['simulcastLayers'];
    mediumTileLayer: keyof MeetingRoomConfig['media']['simulcastLayers'];
    largeTileLayer: keyof MeetingRoomConfig['media']['simulcastLayers'];
    fullscreenLayer: keyof MeetingRoomConfig['media']['simulcastLayers'];
  };
  mobile: {
    enabled: boolean;
    maxResolution: string;
    maxFrameRate: number;
    preferredSimulcastLayerCount: number;
    autoEnableDataSaverOnCellular: boolean;
    reduceQualityWhenBatteryBelowPercent: number;
  };
  performance: {
    cpuMonitorEnabled: boolean;
    cpuReductionThresholdPercent: number;
    cpuReductionThresholdDurationMs: number;
    recoveryThresholdPercent: number;
    qualityRestoreDurationMs: number;
    offscreenPauseDelayMs: number;
    freezeLastFrameWhenPaused: boolean;
    // Phase 2: Visible participant culling
    enableParticipantCulling: boolean;
    maxVisibleParticipants: number;
    cullingThreshold: number;
    // Phase 2: Tab visibility optimization
    pauseVideoOnTabHidden: boolean;
    tabVisibilityHideDelayMs: number;
    // Phase 2: Video element pooling
    enableVideoPooling: boolean;
    videoPoolSize: number;
    videoRecycleDelayMs: number;
  };
  feedback: {
    networkDegradedMessage: string;
    networkRecoveredMessage: string;
    cpuFallbackMessage: string;
    audioOnlyMessage: string;
  };
  notes: {
    publicChatStorage: string;
    privateModeratorChatStorage: string;
    typingIndicatorStorage: string;
    deviceSwitchingImplementation: string;
    livekitServerCodecReference: string;
    livekitServerRoomDefaults: string;
    backgroundBlurImplementation: string;
    meetingRestartBehavior: string;
    cameraAspectRatioSystem: string;
  };
}

type AudioCaptureOptionsWithVolume = AudioCaptureOptions & {
  volume?: number;
};

const fallbackConfig: MeetingRoomConfig = {
  app: {
    apiBaseUrl: '/api',
    livekitUrl: 'ws://localhost:7880',
  },
  room: {
    defaultLayout: 'speaker',
    qualityMode: 'highQuality',  // Changed from 'auto' to use high quality by default
    adaptiveStream: true,
    dynacast: true,
    simulcast: true,
    pauseOffscreenVideo: false,  // Disabled - was causing videos to not appear for moderators
    joinLeaveSoundsEnabled: true,
    mirrorLocalVideo: true,
    showChatTimestamps: false,
    lobbyPollIntervalMs: 10000, // Poll lobby every 10 seconds (was 5s)
  },
  features: {
    fullscreenTileView: true,
    mirrorLocalVideoToggle: true,
    copyRoomLink: true,
    joinLeaveSoundToggle: true,
    participantSearch: true,
    inlineLobbyBanner: true,
    typingIndicator: true,
    privateMessagesToModerators: true,
    chatTimestampsToggle: true,
    deviceSwitchingInRoom: true,
    micDropdownDeviceMenu: true,
    cameraDropdownDeviceMenu: true,
    settingsPanelDeviceFallback: true,
    qualityModeSelector: true,
    connectionQualityIndicator: false,
    networkRecoveryToasts: true,
    screenshareModeSelector: true,
  },
  moderation: {
    muteParticipant: true,
    muteAllParticipants: true,
    disableParticipantCamera: true,
    disableAllParticipantCameras: true,
    disableParticipantScreenShare: true,
    kickParticipant: true,
    admitLobbyParticipant: true,
    denyLobbyParticipant: true,
    admitAllFromLobby: true,
    denyAllFromLobby: true,
    skipModeratorsForMuteAll: true,
    skipModeratorsForDisableAllCameras: true,
  },
  chat: {
    publicChatEnabled: true,
    persistPublicRoomChat: true,
    privateModeratorChatEnabled: true,
    persistPrivateModeratorChat: false,
    typingIndicatorTimeoutMs: 1500,
    maxHistoryMessages: 200,
  },
  prejoin: {
    videoEnabledByDefault: true,
    audioEnabledByDefault: true,
    noiseSuppression: true,
    echoCancellation: true,
    showDeviceSettingsByDefault: true,
    defaultAspectRatio: '16:9',  // Auto-detects camera native ratio for 100% coverage
    defaultVideoFitMode: 'cover',  // 'cover' fills container, 'contain' letterboxes
  },
  videoEffects: {
    backgroundBlur: {
      enabled: true,
      defaultBlurRadius: 10,  // 1-20, higher = more blur
      debounceMs: 300,  // Minimum time between toggle operations
      lockTimeoutMs: 8000,  // Safety valve for async lock
      implementation: 'BackgroundProcessor_switchTo_method',  // Uses switchTo() to avoid TF.js reload
    },
    virtualBackground: {
      enabled: false,  // Not implemented yet
    },
  },
  mediaSwitching: {
    cameraDeviceKind: 'videoinput',
    microphoneDeviceKind: 'audioinput',
    defaultCameraDeviceId: '',
    defaultMicrophoneDeviceId: '',
  },
  qualityModes: {
    defaultMode: 'highQuality',  // Changed from 'dataSaver' for better video quality
    availableModes: ['auto', 'dataSaver', 'highQuality', 'audioOnly'],
    auto: {
      cameraMaxResolution: '1280x720',
      cameraMaxFrameRate: 30,
      screenShareMaxResolution: '1920x1080',
      screenShareMaxFrameRate: 15,
      audioBitrateKbps: 24,
    },
    dataSaver: {
      cameraMaxResolution: '854x480',
      cameraMaxFrameRate: 24,
      screenShareMaxResolution: '1280x720',
      screenShareMaxFrameRate: 15,
      audioBitrateKbps: 24,
    },
    highQuality: {
      cameraMaxResolution: '1920x1080',
      cameraMaxFrameRate: 30,
      screenShareMaxResolution: '1920x1080',
      screenShareMaxFrameRate: 30,
      audioBitrateKbps: 32,
    },
    audioOnly: {
      cameraDisabled: true,
      incomingVideoDisabled: true,
      audioBitrateKbps: 24,
    },
  },
  media: {
    cameraCapture: {
      width: 1280,
      height: 720,
      minWidth: 320,         // Lower min for struggling clients
      maxWidth: 1920,
      minHeight: 180,        // Lower min for struggling clients
      maxHeight: 1080,
      frameRate: 24,         // Reduced from 30 for stability
      minFrameRate: 10,      // Allow lower framerate for struggling clients
      maxFrameRate: 30,
      facingMode: 'user',
    },
    audioCapture: {
      autoGainControl: true,
      echoCancellation: true,
      noiseSuppression: true,
      channelCount: 1,
      latency: 0.02,
      sampleRate: 48000,
      sampleSize: 16,
    },
    publishDefaults: {
      videoCodec: 'h264',
      backupCodec: true,
      backupCodecPolicy: 'regression',
      audioPreset: 'speech',
      dtx: true,
      red: true,             // Redundant encoding for packet loss
      forceStereo: false,
      simulcast: true,
      scalabilityMode: 'L3T3_KEY',
      degradationPreference: 'balanced',  // Balanced adaptation for smoother experience
      videoEncoding: {
        minBitrate: 200000,  // Lower minimum for struggling clients
        maxBitrate: 4500000, // Match ultra layer for 1080p
        minFramerate: 10,    // Lower minimum framerate
        maxFramerate: 30,
      },
      screenShareEncoding: {
        minBitrate: 300000,
        maxBitrate: 800000,  // Reduced for stability
        minFramerate: 3,     // Lower minimum
        maxFramerate: 10,    // Reduced from 15
      },
    },
    simulcastLayers: {
      // Optimized bitrates based on WebRTC best practices for good quality
      // Reference: https://webrtc.github.io/webrtc-org/blog/
      low: { width: 320, height: 180, frameRate: 15, maxBitrate: 200000 },      // Thumbnails, small tiles
      medium: { width: 640, height: 360, frameRate: 24, maxBitrate: 800000 },   // Small grid tiles
      high: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2500000 },   // Medium/large tiles
      ultra: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4500000 }, // Fullscreen, pinned
    },
    screenShare: {
      defaultMode: 'documents',
      resolution: {
        width: 1920,
        height: 1080,
        minWidth: 1280,
        maxWidth: 2560,
        minHeight: 720,
        maxHeight: 1440,
        frameRate: 8,
        minFrameRate: 5,
        maxFrameRate: 15,
      },
      audio: true,
      contentHint: 'detail',
      surfaceSwitching: 'include',
      systemAudio: 'include',
      selfBrowserSurface: 'exclude',
      modes: {
        documents: { width: 1920, height: 1080, frameRate: 8, maxBitrate: 1000000 },
        motion: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 2500000 },
      },
    },
  },
  network: {
    prioritizeAudioOverVideo: true,
    degradeVideoFirstOnCongestion: true,
    packetLossWarningPercent: 1,
    packetLossPoorPercent: 3,
    rttWarningMs: 100,
    rttPoorMs: 200,
    jitterWarningMs: 30,
    jitterPoorMs: 50,
    availableBitrateWarningBps: 500000,
    availableBitrateGoodBps: 2000000,
  },
  activeSpeaker: {
    promotionDelayMs: 200,   // Fast response when someone starts speaking
    demotionDelayMs: 1500,   // Keep last speaker visible briefly after they stop
    pinnedParticipantTargetLayer: 'high',
    hostPresenterTargetLayer: 'ultra',
  },
  layoutQuality: {
    // Tile width thresholds for layer selection (optimized for modern displays)
    // 2-person grid on 1920px width → ~800px tiles → high/ultra layer
    // 4-person grid on 1920px width → ~400px tiles → high layer
    // 6-person grid on 1920px width → ~300px tiles → medium/high layer
    thumbnailMaxWidthPx: 150,
    mediumTileMaxWidthPx: 300,
    largeTileMaxWidthPx: 600,
    thumbnailLayer: 'low',
    mediumTileLayer: 'medium',
    largeTileLayer: 'high',
    fullscreenLayer: 'ultra',  // Use ultra for fullscreen (1080p @ 4.5Mbps)
  },
  mobile: {
    enabled: true,
    maxResolution: '960x540',
    maxFrameRate: 24,
    preferredSimulcastLayerCount: 3,
    autoEnableDataSaverOnCellular: true,
    reduceQualityWhenBatteryBelowPercent: 20,
  },
  performance: {
    cpuMonitorEnabled: true,
    cpuReductionThresholdPercent: 92,
    cpuReductionThresholdDurationMs: 5000,
    recoveryThresholdPercent: 60,
    qualityRestoreDurationMs: 10000,
    offscreenPauseDelayMs: 3000,
    freezeLastFrameWhenPaused: true,
    // Phase 2: Visible participant culling
    enableParticipantCulling: false,
    maxVisibleParticipants: 12,
    cullingThreshold: 12,
    // Phase 2: Tab visibility optimization
    pauseVideoOnTabHidden: false,
    tabVisibilityHideDelayMs: 5000,
    // Phase 2: Video element pooling - ENABLED for better performance
    enableVideoPooling: true,
    videoPoolSize: 12,
    videoRecycleDelayMs: 3000,
  },
  feedback: {
    networkDegradedMessage: 'Optimizing video for your connection',
    networkRecoveredMessage: 'Connection quality restored',
    cpuFallbackMessage: 'Reducing quality to improve performance',
    audioOnlyMessage: 'Audio Only - Tap to enable video',
  },
  notes: {
    publicChatStorage: 'backend_database',
    privateModeratorChatStorage: 'live_only_not_persisted',
    typingIndicatorStorage: 'live_only_not_persisted',
    deviceSwitchingImplementation: 'livekit_room_switchActiveDevice',
    livekitServerCodecReference: 'audio/opus, video/vp8, video/h264, video/vp9, video/av1',
    livekitServerRoomDefaults: 'auto_create=false, empty_timeout=300, departure_timeout=20, max_participants=50',
    backgroundBlurImplementation: 'blurProcessorManager.ts uses BackgroundProcessor with switchTo() method - keeps TF.js loaded',
    meetingRestartBehavior: 'Host restart sets room status to waiting immediately to prevent race condition',
    cameraAspectRatioSystem: 'Auto-detects native ratio, calculates optimal crop resolution for selected aspect',
  },
};

function stripJsonComments(source: string) {
  return source
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/,\s*([}\]])/g, '$1');
}

function loadConfig(): MeetingRoomConfig {
  try {
    return JSON.parse(stripJsonComments(rawConfig)) as MeetingRoomConfig;
  } catch (error) {
    logger.error('Failed to parse meeting room config, falling back to defaults:', error);
    return fallbackConfig;
  }
}

function parseResolution(value?: string) {
  if (!value) {
    return null;
  }

  const match = /^(\d+)x(\d+)$/i.exec(value);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function isMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
}

function isCellularConnection() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  const connection = (navigator as Navigator & {
    connection?: { type?: string; effectiveType?: string };
  }).connection;

  if (!connection) {
    return false;
  }

  return connection.type === 'cellular' || connection.effectiveType === '2g' || connection.effectiveType === '3g';
}

function getPreferredQualityMode(mode?: QualityModeName) {
  if (mode) {
    return mode;
  }

  if (
    meetingRoomConfig.mobile.autoEnableDataSaverOnCellular &&
    isCellularConnection()
  ) {
    return 'dataSaver';
  }

  if (isMobileViewport() && meetingRoomConfig.mobile.enabled) {
    return 'dataSaver';
  }

  return meetingRoomConfig.qualityModes.defaultMode || meetingRoomConfig.room.qualityMode;
}

export const meetingRoomConfig = loadConfig();

// ─────────────────────────────────────────────────────────────────────────────
// MEMOIZATION CACHES
// Simple caches for frequently-called config functions
// ─────────────────────────────────────────────────────────────────────────────

const qualityModeConfigCache = new Map<QualityModeName | undefined, { name: QualityModeName; settings: QualityModeConfig }>();
const audioCaptureOptionsCache = new Map<string, AudioCaptureOptionsWithVolume>();

export function getQualityModeConfig(mode?: QualityModeName): { name: QualityModeName; settings: QualityModeConfig } {
  // Check cache first
  const cached = qualityModeConfigCache.get(mode);
  if (cached) return cached;
  
  const name = getPreferredQualityMode(mode);
  const result = {
    name,
    settings: meetingRoomConfig.qualityModes[name],
  };
  
  // Cache the result
  qualityModeConfigCache.set(mode, result);
  return result;
}

/**
 * Calculate the best resolution for a target aspect ratio
 * that fits within the maximum allowed resolution.
 * 
 * Example: max 1280x720, target 4:3 → returns 960x720
 */
function calculateAspectMatchedResolution(
  maxWidth: number,
  maxHeight: number,
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:3'
): { width: number; height: number } {
  // Parse target aspect ratio
  const aspectRatios: Record<string, number> = {
    '16:9': 16 / 9,   // 1.778
    '9:16': 9 / 16,   // 0.5625
    '1:1': 1,         // 1.0
    '4:3': 4 / 3,     // 1.333
  };
  
  const targetRatio = aspectRatios[aspectRatio];
  const maxRatio = maxWidth / maxHeight;
  
  let width: number;
  let height: number;
  
  if (targetRatio > maxRatio) {
    // Target is wider - fit to max width
    width = maxWidth;
    height = Math.round(maxWidth / targetRatio);
  } else {
    // Target is taller - fit to max height
    height = maxHeight;
    width = Math.round(maxHeight * targetRatio);
  }
  
  // Ensure dimensions are even numbers (required by some codecs)
  width = Math.floor(width / 2) * 2;
  height = Math.floor(height / 2) * 2;
  
  return { width, height };
}

// Aspect ratio numeric values for browser constraint
const ASPECT_RATIO_VALUES: Record<string, number> = {
  '16:9': 16 / 9,   // 1.778
  '9:16': 9 / 16,   // 0.5625
  '1:1': 1,         // 1.0
  '4:3': 4 / 3,     // 1.333
};

/**
 * Camera capabilities from hardware detection
 */
export interface CameraHardwareCaps {
  maxWidth: number;
  maxHeight: number;
  nativeAspectRatio: number;
}

/**
 * Build camera capture options based on actual camera hardware capabilities.
 * 
 * Flow:
 * 1. Detect camera's native resolution (e.g., 1280×720)
 * 2. Apply quality mode cap (e.g., highQuality allows up to 1920×1080)
 * 3. Calculate optimal resolution for selected aspect ratio
 * 4. Return capture constraints
 */
export function buildCameraCaptureOptions(
  selectedCamera?: string, 
  mode?: QualityModeName,
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3',
  hardwareCaps?: CameraHardwareCaps | null
): VideoCaptureOptions {
  const { cameraCapture } = meetingRoomConfig.media;
  const { settings } = getQualityModeConfig(mode);
  const targetResolution = parseResolution(settings.cameraMaxResolution);
  const maxFrameRate = settings.cameraMaxFrameRate ?? cameraCapture.maxFrameRate;
  
  // Step 1: Determine the effective maximum resolution
  // Priority: hardware capability → quality mode cap → config default
  let maxWidth: number;
  let maxHeight: number;
  let nativeAspectRatio: number;
  
  if (hardwareCaps) {
    // Use actual camera hardware capabilities
    maxWidth = hardwareCaps.maxWidth;
    maxHeight = hardwareCaps.maxHeight;
    nativeAspectRatio = hardwareCaps.nativeAspectRatio;
    logger.info(`📷 Camera native: ${maxWidth}×${maxHeight} (${nativeAspectRatio.toFixed(3)})`);
  } else {
    // Fallback to config-based limits
    maxWidth = Math.min(targetResolution?.width ?? cameraCapture.width, cameraCapture.maxWidth);
    maxHeight = Math.min(targetResolution?.height ?? cameraCapture.height, cameraCapture.maxHeight);
    nativeAspectRatio = maxWidth / maxHeight;
  }
  
  // Apply quality mode cap (don't exceed what quality mode allows)
  const qualityMaxWidth = targetResolution?.width ?? cameraCapture.maxWidth;
  const qualityMaxHeight = targetResolution?.height ?? cameraCapture.maxHeight;
  maxWidth = Math.min(maxWidth, qualityMaxWidth);
  maxHeight = Math.min(maxHeight, qualityMaxHeight);
  
  // Step 2: Calculate optimal resolution for target aspect ratio
  const targetRatio = aspectRatio || '16:9';
  const targetRatioValue = ASPECT_RATIO_VALUES[targetRatio];
  
  let width: number;
  let height: number;
  
  if (targetRatio === '16:9') {
    // For 16:9, use the full available resolution (native or capped)
    width = maxWidth;
    height = maxHeight;
  } else {
    // For other ratios, calculate the optimal crop from native
    const matched = calculateAspectMatchedResolution(maxWidth, maxHeight, targetRatio);
    width = matched.width;
    height = matched.height;
  }
  
  logger.info(`📷 Capture: ${width}×${height} @ ${targetRatio} (native caps: ${hardwareCaps ? `${hardwareCaps.maxWidth}×${hardwareCaps.maxHeight}` : 'unknown'})`);

  return {
    deviceId: selectedCamera || undefined,
    facingMode: cameraCapture.facingMode,
    resolution: {
      width,
      height,
      frameRate: Math.min(cameraCapture.frameRate, maxFrameRate),
      aspectRatio: targetRatioValue,
    },
    frameRate: {
      ideal: Math.min(cameraCapture.frameRate, maxFrameRate),
      min: cameraCapture.minFrameRate,
      max: maxFrameRate,
    },
  };
}

export function buildAudioCaptureOptions(
  selectedMic?: string,
  noiseSuppression?: boolean,
  echoCancellation?: boolean,
  micLevel: number = 100,
): AudioCaptureOptionsWithVolume {
  // Create cache key from all parameters
  const cacheKey = `${selectedMic ?? ''}|${noiseSuppression ?? ''}|${echoCancellation ?? ''}|${micLevel}`;
  
  // Check cache first
  const cached = audioCaptureOptionsCache.get(cacheKey);
  if (cached) return cached;
  
  const { audioCapture } = meetingRoomConfig.media;
  const result: AudioCaptureOptionsWithVolume = {
    deviceId: selectedMic || undefined,
    volume: micLevel / 100,
    noiseSuppression: noiseSuppression ?? audioCapture.noiseSuppression,
    echoCancellation: echoCancellation ?? audioCapture.echoCancellation,
    autoGainControl: audioCapture.autoGainControl,
    channelCount: audioCapture.channelCount,
    latency: audioCapture.latency,
    sampleRate: audioCapture.sampleRate,
    sampleSize: audioCapture.sampleSize,
  };
  
  // Cache the result
  audioCaptureOptionsCache.set(cacheKey, result);
  return result;
}

export function resolveAudioPreset(mode?: QualityModeName) {
  const { settings } = getQualityModeConfig(mode);
  const configuredPreset = settings.audioBitrateKbps >= 32 ? 'musicHighQuality' : meetingRoomConfig.media.publishDefaults.audioPreset;
  return AudioPresets[configuredPreset] ?? AudioPresets[meetingRoomConfig.media.publishDefaults.audioPreset];
}

export function resolveBackupCodecPolicy() {
  const policy = meetingRoomConfig.media.publishDefaults.backupCodecPolicy;
  if (policy === 'simulcast') return BackupCodecPolicy.SIMULCAST;
  if (policy === 'prefer_regression') return BackupCodecPolicy.PREFER_REGRESSION;
  return BackupCodecPolicy.REGRESSION;
}

export function getVideoSimulcastLayers(mode?: QualityModeName) {
  const { settings, name } = getQualityModeConfig(mode);
  const layerOrder: Array<keyof MeetingRoomConfig['media']['simulcastLayers']> =
    name === 'dataSaver' || (isMobileViewport() && meetingRoomConfig.mobile.enabled)
      ? ['low', 'medium', 'high']
      : ['low', 'medium', 'high', 'ultra'];

  return layerOrder
    .map((key) => meetingRoomConfig.media.simulcastLayers[key])
    .filter((layer) => {
      const resolution = parseResolution(settings.cameraMaxResolution);
      return !resolution || layer.width <= resolution.width;
    })
    .map((layer) => new VideoPreset(layer.width, layer.height, layer.maxBitrate, layer.frameRate));
}

export function getScreenShareOptions(mode?: QualityModeName, screenShareMode?: ScreenShareModeName) {
  const effectiveScreenShareMode = screenShareMode ?? meetingRoomConfig.media.screenShare.defaultMode;
  const shareProfile = meetingRoomConfig.media.screenShare.modes[effectiveScreenShareMode];
  const { settings } = getQualityModeConfig(mode);
  const resolution = parseResolution(settings.screenShareMaxResolution);

  const width = Math.min(shareProfile.width, resolution?.width ?? shareProfile.width);
  const height = Math.min(shareProfile.height, resolution?.height ?? shareProfile.height);
  const frameRate = Math.min(shareProfile.frameRate, settings.screenShareMaxFrameRate ?? shareProfile.frameRate);

  return {
    audio: meetingRoomConfig.media.screenShare.audio,
    resolution: {
      width,
      height,
      frameRate,
    },
    contentHint: effectiveScreenShareMode === 'motion' ? 'motion' : meetingRoomConfig.media.screenShare.contentHint,
    surfaceSwitching: meetingRoomConfig.media.screenShare.surfaceSwitching,
    systemAudio: meetingRoomConfig.media.screenShare.systemAudio,
    selfBrowserSurface: meetingRoomConfig.media.screenShare.selfBrowserSurface,
    encoding: {
      maxBitrate: shareProfile.maxBitrate,
      maxFramerate: frameRate,
    },
  };
}

export function getAdaptiveStreamOptions() {
  if (!meetingRoomConfig.room.adaptiveStream) {
    return false;
  }

  return {
    pauseVideoInBackground: meetingRoomConfig.room.pauseOffscreenVideo,
  };
}

export function isAudioOnlyMode(mode?: QualityModeName) {
  return getQualityModeConfig(mode).name === 'audioOnly';
}

export function resolveVideoQuality(layerName: SimulcastLayerName) {
  if (layerName === 'low') {
    return VideoQuality.LOW;
  }
  if (layerName === 'medium') {
    return VideoQuality.MEDIUM;
  }
  return VideoQuality.HIGH;
}

export function resolveTileTargetLayer(options: {
  width: number;
  isFullscreen: boolean;
  isPinned: boolean;
  isHostPresenter: boolean;
  qualityMode?: string;
  gridParticipantCount?: number;
  screenWidth?: number;
}) {
  if (options.isFullscreen) {
    // Even in data saver, fullscreen needs decent quality
    return options.qualityMode === 'dataSaver' 
      ? 'medium' as const  // 640×360 @ 800 Kbps for data saver fullscreen
      : meetingRoomConfig.layoutQuality.fullscreenLayer;
  }
  if (options.isPinned) {
    return meetingRoomConfig.activeSpeaker.pinnedParticipantTargetLayer;
  }
  if (options.isHostPresenter) {
    return meetingRoomConfig.activeSpeaker.hostPresenterTargetLayer;
  }

  const gridCount = options.gridParticipantCount ?? 1;
  const isLargeGrid = gridCount >= 4;

  // Data Saver Mode: Use more conservative thresholds
  if (options.qualityMode === 'dataSaver') {
    if (isLargeGrid) {
      // 4+ participants: Very conservative
      if (options.width <= 120) return 'low' as const;    // 320×180 @ 200 Kbps
      if (options.width <= 250) return 'low' as const;    // Still low for medium tiles
      return 'medium' as const;                           // 640×360 @ 800 Kbps max
    } else {
      // ≤3 participants: Slightly better quality
      if (options.width <= 150) return 'low' as const;    // 320×180 @ 200 Kbps
      if (options.width <= 350) return 'medium' as const; // 640×360 @ 800 Kbps
      return 'medium' as const;                           // Cap at medium
    }
  }

  // High Quality Mode: Force high for pinned/fullscreen
  if (options.qualityMode === 'highQuality' && (options.isFullscreen || options.isPinned)) {
    return 'high' as const;
  }

  // Auto Mode (default): Grid-based optimization
  if (isLargeGrid) {
    // Large grid (4+ participants): Use lower thresholds to save bandwidth
    // Tiles are smaller, so lower quality is acceptable
    if (options.width <= 100) return 'low' as const;     // 320×180 @ 200 Kbps
    if (options.width <= 200) return 'medium' as const;  // 640×360 @ 800 Kbps
    return 'high' as const;                              // 1280×720 @ 2.5 Mbps
  }

  // Small grid (≤3 participants): Use adaptive thresholds based on screen size
  // Larger screens need higher thresholds to avoid pixelation
  const baseScreenWidth = 1920;
  const screenWidth = options.screenWidth ?? (typeof window !== 'undefined' ? window.innerWidth : baseScreenWidth);
  const scaleFactor = screenWidth / baseScreenWidth;
  
  const thumbnailThreshold = Math.round(meetingRoomConfig.layoutQuality.thumbnailMaxWidthPx * scaleFactor);
  const mediumThreshold = Math.round(meetingRoomConfig.layoutQuality.mediumTileMaxWidthPx * scaleFactor);
  const largeThreshold = Math.round(meetingRoomConfig.layoutQuality.largeTileMaxWidthPx * scaleFactor);

  if (options.width <= thumbnailThreshold) {
    return 'medium' as const;  // Bump thumbnails to medium for small grids
  }
  if (options.width <= mediumThreshold) {
    return 'high' as const;    // Bump medium tiles to high for small grids
  }
  if (options.width <= largeThreshold) {
    return meetingRoomConfig.layoutQuality.largeTileLayer;
  }
  return meetingRoomConfig.layoutQuality.fullscreenLayer;
}

// Adaptive Quality Configuration
export const ADAPTIVE_CONFIG = {
  enabled: true,
  
  // Call size thresholds
  largeCallThreshold: 8,
  veryLargeCallThreshold: 16,
  
  // Network quality scoring
  networkQuality: {
    checkIntervalMs: 5000,
    debounceMs: 5000,
    scoreThresholds: {
      excellent: 80,  // 80-100: Excellent
      good: 60,       // 60-79: Good
      fair: 40,       // 40-59: Fair
      // 0-39: Poor
    },
  },
  
  // CPU-based degradation
  cpuDegradation: {
    enabled: true,
    highThreshold: 80,      // % CPU usage
    criticalThreshold: 90,  // % CPU usage
    checkIntervalMs: 2000,
  },
  
  // Tab visibility optimization
  visibility: {
    enabled: true,
    backgroundFramerate: 15,
    idleTimeoutMs: 300000, // 5 minutes
  },
  
  // Resolution caps by call size
  resolutionCaps: {
    small: { max: { width: 1920, height: 1080 }, simulcastLayers: 4, framerate: 30 },
    large: { max: { width: 1280, height: 720 }, simulcastLayers: 3, framerate: 24 },
    veryLarge: { max: { width: 1280, height: 720 }, simulcastLayers: 2, framerate: 24 },
  },
} as const;
