import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getQualityModeConfig,
  isAudioOnlyMode,
  meetingRoomConfig,
  type QualityModeName,
  type ScreenShareModeName,
  type CameraHardwareCaps,
} from '../config/meetingRoomConfig';
import { getCameraCapabilities, logCameraInfo } from '../utils/cameraCapabilities';
import type { GridAspectRatio, VideoFitMode } from '../store/roomStore';
import toast from 'react-hot-toast';
import logger from '../utils/logger';
import type { DeviceList } from '../components/prejoin';

/**
 * Build MediaTrackConstraints for getUserMedia from the same options
 * that buildCameraCaptureOptions uses. This avoids importing livekit-client
 * on the PreJoin page (saves ~500KB from the initial chunk).
 */
function buildCameraConstraints(
  selectedCamera?: string,
  mode?: QualityModeName,
  _aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3',
  hardwareCaps?: CameraHardwareCaps | null,
): MediaTrackConstraints {
  const { cameraCapture } = meetingRoomConfig.media;
  const { settings } = getQualityModeConfig(mode);

  const targetResolution = settings
    ? { width: 1280, height: 720 }
    : { width: cameraCapture.width, height: cameraCapture.height };

  let maxWidth: number;
  let maxHeight: number;

  if (hardwareCaps) {
    maxWidth = hardwareCaps.maxWidth;
    maxHeight = hardwareCaps.maxHeight;
  } else {
    maxWidth = Math.min(targetResolution.width, cameraCapture.maxWidth);
    maxHeight = Math.min(targetResolution.height, cameraCapture.maxHeight);
  }

  // Apply quality mode cap
  maxWidth = Math.min(maxWidth, targetResolution.width);
  maxHeight = Math.min(maxHeight, targetResolution.height);

  const maxFrameRate = settings?.cameraMaxFrameRate ?? cameraCapture.maxFrameRate;

  const constraints: MediaTrackConstraints = {
    deviceId: selectedCamera || undefined,
    width: { ideal: maxWidth },
    height: { ideal: maxHeight },
  };

  if (maxFrameRate) {
    constraints.frameRate = { ideal: maxFrameRate };
  }

  if (!selectedCamera) {
    constraints.facingMode = cameraCapture.facingMode as ConstrainDOMString;
  }

  return constraints;
}

interface UsePreJoinMediaParams {
  roomName: string | undefined;
  isCreateMode: boolean;
}

export function usePreJoinMedia({ roomName, isCreateMode }: UsePreJoinMediaParams) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const isMountedRef = useRef(true);
  const hasRequestedPermissionsRef = useRef(false);

  const [videoEnabled, setVideoEnabled] = useState(meetingRoomConfig.prejoin.videoEnabledByDefault);
  const [audioEnabled, setAudioEnabled] = useState(meetingRoomConfig.prejoin.audioEnabledByDefault);
  const [devices, setDevices] = useState<DeviceList>({
    cameras: [],
    mics: [],
    speakers: [],
  });
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [micLevel, setMicLevel] = useState(100);
  const [speakerLevel, setSpeakerLevel] = useState(100);
  const [noiseSuppression, setNoiseSuppression] = useState(meetingRoomConfig.prejoin.noiseSuppression);
  const [echoCancellation, setEchoCancellation] = useState(meetingRoomConfig.prejoin.echoCancellation);
  const [backgroundBlur, setBackgroundBlur] = useState(false);
  const [backgroundBlurLevel, setBackgroundBlurLevel] = useState(10);
  const [videoFilter, setVideoFilter] = useState<'none' | 'lightweight'>('none'); // Default OFF
  const [qualityMode, setQualityMode] = useState<QualityModeName>(getQualityModeConfig().name);
  const [screenShareMode, setScreenShareMode] = useState<ScreenShareModeName>(meetingRoomConfig.media.screenShare.defaultMode);
  // Default to 16:9 (100% camera coverage for most webcams)
  // Will auto-update to camera's native ratio when detected
  const [gridAspectRatio, setGridAspectRatioState] = useState<GridAspectRatio>('16:9');
  const [videoFitMode, setVideoFitMode] = useState<VideoFitMode>('cover');
  const [showDeviceSettings, setShowDeviceSettings] = useState(meetingRoomConfig.prejoin.showDeviceSettingsByDefault);
  const [initializing, setInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Loading...');

  // Camera hardware capabilities (detected from actual device)
  const [cameraHardwareCaps, setCameraHardwareCaps] = useState<CameraHardwareCaps | null>(null);

  // Track if we've auto-selected aspect ratio based on camera (do once per camera)
  const aspectRatioAutoSelectedRef = useRef(false);

  // Collapsible sections state - devices uncollapsed by default
  const [expandedSections, setExpandedSections] = useState({
    devices: true,
    audio: false,
    video: false,
    moderator: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const stopPreview = useCallback(() => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((t) => t.stop());
      previewStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Helper: Find closest aspect ratio option to camera's native ratio
  // Prioritizes >92% sensor coverage
  const getClosestAspectRatio = useCallback((nativeRatio: number): GridAspectRatio => {
    const ratios: { ratio: GridAspectRatio; value: number }[] = [
      { ratio: '16:9', value: 16 / 9 }, // 1.778
      { ratio: '9:16', value: 9 / 16 }, // 0.5625
      { ratio: '4:3', value: 4 / 3 }, // 1.333
      { ratio: '1:1', value: 1 }, // 1.0
    ];

    // Find closest match
    let closest = ratios[0];
    let minDiff = Math.abs(nativeRatio - closest.value);

    for (const r of ratios) {
      const diff = Math.abs(nativeRatio - r.value);
      if (diff < minDiff) {
        minDiff = diff;
        closest = r;
      }
    }

    logger.info(`📷 Native ratio ${nativeRatio.toFixed(3)} → closest: ${closest.ratio} (${closest.value.toFixed(3)})`);
    return closest.ratio;
  }, []);

  async function loadDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: all.filter((d) => d.kind === 'videoinput'),
        mics: all.filter((d) => d.kind === 'audioinput'),
        speakers: all.filter((d) => d.kind === 'audiooutput'),
      });
    } catch (e) {
      logger.error('Failed to enumerate devices:', e);
      toast.error('Could not detect audio/video devices.');
    }
  }

  async function startPreview(reuseTrack?: MediaStreamTrack | null) {
    if (!videoEnabled || isAudioOnlyMode(qualityMode)) return;

    try {
      stopPreview();

      // Detect camera capabilities if not already done
      let hwCaps = cameraHardwareCaps;
      let effectiveAspectRatio = gridAspectRatio;

      if (!hwCaps && !reuseTrack) {
        const caps = await getCameraCapabilities(selectedCamera || undefined);
        if (caps) {
          hwCaps = {
            maxWidth: caps.maxWidth,
            maxHeight: caps.maxHeight,
            nativeAspectRatio: caps.nativeAspectRatio,
          };
          setCameraHardwareCaps(hwCaps);
          logCameraInfo(caps);

          if (!aspectRatioAutoSelectedRef.current) {
            const nativeRatio = getClosestAspectRatio(caps.nativeAspectRatio);
            effectiveAspectRatio = nativeRatio;
            setGridAspectRatioState(nativeRatio);
            aspectRatioAutoSelectedRef.current = true;
            logger.info(`📷 Auto-selected aspect ratio: ${nativeRatio} (native: ${caps.nativeAspectRatio.toFixed(3)})`);
          }
        }
      }

      let stream: MediaStream;

      if (reuseTrack && reuseTrack.readyState === 'live') {
        logger.info('📷 Reusing permission video track for preview (1 request optimization)');
        stream = new MediaStream([reuseTrack]);
      } else {
        // Use raw getUserMedia instead of LiveKit's createLocalVideoTrack
        const constraints = buildCameraConstraints(selectedCamera, qualityMode, effectiveAspectRatio, hwCaps);
        stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
      }

      if (!isMountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      previewStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      logger.error('Failed to start video preview:', e);
      if (isMountedRef.current) {
        toast.error('Could not start camera preview.');
        setVideoEnabled(false);
        setDevices((prev) => ({
          ...prev,
          cameras: prev.cameras.filter((d) => d.deviceId !== selectedCamera),
        }));
      }
    }
  }

  const toggleVideo = useCallback(async () => {
    if (videoEnabled) {
      stopPreview();
      setVideoEnabled(false);
    } else {
      try {
        stopPreview();
        const constraints = buildCameraConstraints(selectedCamera, qualityMode, gridAspectRatio, cameraHardwareCaps);
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });
        if (!isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        previewStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setVideoEnabled(true);
      } catch (e) {
        logger.error('Failed to start video preview:', e);
        toast.error('Could not start camera');
      }
    }
  }, [videoEnabled, selectedCamera, qualityMode, gridAspectRatio, cameraHardwareCaps, stopPreview]);

  // Init preview effect
  useEffect(() => {
    isMountedRef.current = true;

    const initPreview = async () => {
      // Prevent multiple permission requests (React StrictMode double-mount)
      if (hasRequestedPermissionsRef.current) {
        return;
      }
      hasRequestedPermissionsRef.current = true;

      try {
        setInitStatus('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: true,
        });

        // Extract video track for preview reuse (avoid 2nd request)
        const videoTrack = stream.getVideoTracks()[0];

        // Stop only audio tracks, keep video for preview
        stream.getAudioTracks().forEach((track) => track.stop());

        setInitStatus('Loading devices...');
        await loadDevices();

        setInitStatus('Starting preview...');
        await startPreview(videoTrack);

        if (isMountedRef.current) {
          setInitializing(false);
        }
      } catch (e) {
        logger.error('Failed to get permissions:', e);
        toast.error('Could not access camera and microphone. Please check permissions.');
        try {
          setInitStatus('Requesting camera only...');
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          const videoTrack = videoStream.getVideoTracks()[0];

          setVideoEnabled(true);
          setAudioEnabled(false);
          await loadDevices();
          await startPreview(videoTrack);
          if (isMountedRef.current) {
            setInitializing(false);
          }
        } catch (videoError) {
          logger.error('Video permission denied:', videoError);
          toast.error('Camera and microphone access denied. You may still join with limited functionality.');
          setVideoEnabled(false);
          setAudioEnabled(false);
          if (isMountedRef.current) {
            setInitializing(false);
          }
        }
      }
    };

    void initPreview();

    return () => {
      isMountedRef.current = false;
      stopPreview();
    };
    // startPreview and loadDevices are intentionally omitted — they are plain
    // functions (new reference each render) which would cause the effect to
    // re-run on every state change, calling stopPreview() in cleanup and
    // killing the camera stream immediately after it starts.
    // The hasRequestedPermissionsRef guard ensures they only execute once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, isCreateMode, stopPreview]);

  // Camera change effect
  useEffect(() => {
    if (!selectedCamera || !videoEnabled || !previewStreamRef.current) return;

    let cancelled = false;
    stopPreview();

    const detectAndStart = async () => {
      const caps = await getCameraCapabilities(selectedCamera);
      if (caps) {
        const hwCaps: CameraHardwareCaps = {
          maxWidth: caps.maxWidth,
          maxHeight: caps.maxHeight,
          nativeAspectRatio: caps.nativeAspectRatio,
        };
        setCameraHardwareCaps(hwCaps);
        logCameraInfo(caps);

        const nativeRatio = getClosestAspectRatio(caps.nativeAspectRatio);
        if (!aspectRatioAutoSelectedRef.current) {
          setGridAspectRatioState(nativeRatio);
          logger.info(`📷 Camera changed - auto-selected aspect ratio: ${nativeRatio}`);
        }

        if (cancelled) return;

        const constraints = buildCameraConstraints(selectedCamera, qualityMode, nativeRatio, hwCaps);
        const stream = await navigator.mediaDevices.getUserMedia({ video: constraints });

        if (cancelled || !isMountedRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        previewStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }
    };

    detectAndStart().catch((error) => {
      logger.error('Failed to switch camera:', error);
      if (!cancelled && isMountedRef.current) {
        toast.error('Failed to switch camera');
      }
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, videoEnabled, qualityMode, stopPreview]);

  useEffect(() => {
    if (!isAudioOnlyMode(qualityMode)) {
      return;
    }

    stopPreview();
    setVideoEnabled(false);
  }, [qualityMode, stopPreview]);

  const setGridAspectRatio = useCallback((ratio: GridAspectRatio) => {
    aspectRatioAutoSelectedRef.current = true;
    setGridAspectRatioState(ratio);
  }, []);

  return {
    // Refs
    videoRef,
    // State
    videoEnabled,
    setVideoEnabled,
    audioEnabled,
    setAudioEnabled,
    devices,
    selectedCamera,
    setSelectedCamera,
    selectedMic,
    setSelectedMic,
    selectedSpeaker,
    setSelectedSpeaker,
    micLevel,
    setMicLevel,
    speakerLevel,
    setSpeakerLevel,
    noiseSuppression,
    setNoiseSuppression,
    echoCancellation,
    setEchoCancellation,
    backgroundBlur,
    setBackgroundBlur,
    backgroundBlurLevel,
    setBackgroundBlurLevel,
    videoFilter,
    setVideoFilter,
    qualityMode,
    setQualityMode,
    screenShareMode,
    setScreenShareMode,
    gridAspectRatio,
    setGridAspectRatio,
    videoFitMode,
    setVideoFitMode,
    cameraHardwareCaps,
    showDeviceSettings,
    setShowDeviceSettings,
    expandedSections,
    toggleSection,
    initializing,
    initStatus,
    // Functions
    toggleVideo,
    stopPreview,
  };
}
