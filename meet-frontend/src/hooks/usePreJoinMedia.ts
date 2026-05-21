import { useState, useEffect, useRef, useCallback } from 'react';
import { createLocalVideoTrack, LocalVideoTrack } from 'livekit-client';
import {
  buildCameraCaptureOptions,
  getQualityModeConfig,
  isAudioOnlyMode,
  meetingRoomConfig,
  type QualityModeName,
  type ScreenShareModeName,
  type CameraHardwareCaps,
} from '../config/meetingRoomConfig';
import { getCameraCapabilities, logCameraInfo } from '../utils/cameraCapabilities';
import { forceCleanup } from '../utils/blurProcessorManager';
import type { GridAspectRatio, VideoFitMode } from '../store/roomStore';
import toast from 'react-hot-toast';
import logger from '../utils/logger';
import type { DeviceList } from '../components/prejoin';

interface UsePreJoinMediaParams {
  roomName: string | undefined;
  isCreateMode: boolean;
}

export function usePreJoinMedia({ roomName, isCreateMode }: UsePreJoinMediaParams) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const permissionStreamRef = useRef<MediaStream | null>(null);
  const permissionVideoTrackRef = useRef<MediaStreamTrack | null>(null); // Reuse for preview
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
  const [backgroundBlur] = useState(false); // Disabled - no UI to change this
  const [blurActivating] = useState(false); // Disabled - no UI to change this
  const [videoFilter, setVideoFilter] = useState<'none' | 'lightweight'>('none'); // Default OFF
  const [qualityMode, setQualityMode] = useState<QualityModeName>(getQualityModeConfig().name);
  const [screenShareMode, setScreenShareMode] = useState<ScreenShareModeName>(meetingRoomConfig.media.screenShare.defaultMode);
  // Default to 16:9 (100% camera coverage for most webcams)
  // Will auto-update to camera's native ratio when detected
  const [gridAspectRatio, setGridAspectRatio] = useState<GridAspectRatio>('16:9');
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
    // Clear permission video track reference when stopping
    permissionVideoTrackRef.current = null;

    const track = videoTrackRef.current;
    if (track) {
      track.detach();
      track.stop();
      videoTrackRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopPermissionStream = useCallback((keepVideoTrack = false) => {
    if (!permissionStreamRef.current) {
      return;
    }
    permissionStreamRef.current.getTracks().forEach((track) => {
      // Keep video track for preview reuse if requested
      if (keepVideoTrack && track.kind === 'video') {
        return;
      }
      track.stop();
    });

    // If not keeping video track, clear the ref
    if (!keepVideoTrack) {
      permissionVideoTrackRef.current = null;
      permissionStreamRef.current = null;
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
      let effectiveAspectRatio = gridAspectRatio; // Use state by default

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

          // Auto-select aspect ratio matching camera's native ratio (only once)
          // This ensures >92% sensor coverage by default
          if (!aspectRatioAutoSelectedRef.current) {
            const nativeRatio = getClosestAspectRatio(caps.nativeAspectRatio);
            effectiveAspectRatio = nativeRatio; // Use immediately for this capture
            setGridAspectRatio(nativeRatio);
            aspectRatioAutoSelectedRef.current = true;
            logger.info(`📷 Auto-selected aspect ratio: ${nativeRatio} (native: ${caps.nativeAspectRatio.toFixed(3)})`);
          }
        }
      }

      let track: LocalVideoTrack;

      // Reuse existing track if provided (optimization: avoids 2nd getUserMedia call)
      if (reuseTrack && reuseTrack.readyState === 'live') {
        logger.info('📷 Reusing permission video track for preview (1 request optimization)');
        // Create LocalVideoTrack from existing MediaStreamTrack
        track = new LocalVideoTrack(reuseTrack, undefined, false);
      } else {
        // No track to reuse, create new one
        track = await createLocalVideoTrack(
          buildCameraCaptureOptions(selectedCamera, qualityMode, effectiveAspectRatio, hwCaps)
        );
      }

      // Background blur - DISABLED

      if (!isMountedRef.current) {
        track.stop();
        return;
      }
      videoTrackRef.current = track;
      if (videoRef.current) track.attach(videoRef.current);
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
        const track = await createLocalVideoTrack(
          buildCameraCaptureOptions(selectedCamera, qualityMode, gridAspectRatio, cameraHardwareCaps)
        );
        if (!isMountedRef.current) {
          track.stop();
          return;
        }
        videoTrackRef.current = track;
        if (videoRef.current) track.attach(videoRef.current);
        setVideoEnabled(true);
      } catch (e) {
        logger.error('Failed to start video preview:', e);
        toast.error('Could not start camera');
      }
    }
    // gridAspectRatio and cameraHardwareCaps intentionally omitted - changes would cause unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEnabled, selectedCamera, qualityMode, stopPreview]);

  // Init preview effect
  useEffect(() => {
    isMountedRef.current = true;

    // Request permissions - using a local function to avoid dependency issues
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
        permissionStreamRef.current = stream;

        // Extract video track for preview reuse (avoid 2nd request)
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          permissionVideoTrackRef.current = videoTrack;
        }

        // Stop only audio tracks, keep video for preview
        stream.getAudioTracks().forEach((track) => track.stop());

        setInitStatus('Loading devices...');
        await loadDevices();

        setInitStatus('Starting preview...');
        await startPreview(permissionVideoTrackRef.current);

        if (isMountedRef.current) {
          setInitializing(false);
        }
      } catch (e) {
        logger.error('Failed to get permissions:', e);
        toast.error('Could not access camera and microphone. Please check permissions.');
        try {
          setInitStatus('Requesting camera only...');
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          permissionStreamRef.current = videoStream;

          // Extract video track for preview reuse
          const videoTrack = videoStream.getVideoTracks()[0];
          if (videoTrack) {
            permissionVideoTrackRef.current = videoTrack;
          }

          setVideoEnabled(true);
          setAudioEnabled(false);
          await loadDevices();
          await startPreview(permissionVideoTrackRef.current);
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
      // Stop video track first via preview
      stopPreview();
      // Clean up permission stream (skip video - already stopped above)
      stopPermissionStream(true);
      // Clean up blur processor via manager
      void forceCleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomName, isCreateMode, stopPermissionStream, stopPreview]);

  useEffect(() => {
    return () => {
      // Stop video track first via preview
      stopPreview();
      // Clean up permission stream (skip video - already stopped above)
      stopPermissionStream(true);
    };
  }, [stopPermissionStream, stopPreview]);

  // Note: Pre-warming blur processor removed - new blur manager creates fresh processors
  // This avoids stale state issues and memory leaks

  // Camera change effect
  useEffect(() => {
    if (!selectedCamera || !videoEnabled || !videoTrackRef.current) return;

    let cancelled = false;
    stopPreview();

    // Reset blur processor for new camera track - DISABLED
    // resetForNewTrack();

    // Re-detect capabilities when camera changes
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

        // Auto-select aspect ratio for new camera
        const nativeRatio = getClosestAspectRatio(caps.nativeAspectRatio);
        setGridAspectRatio(nativeRatio);
        logger.info(`📷 Camera changed - auto-selected aspect ratio: ${nativeRatio}`);

        if (cancelled) return;

        // Use nativeRatio immediately (not state which is async)
        const track = await createLocalVideoTrack(
          buildCameraCaptureOptions(selectedCamera, qualityMode, nativeRatio, hwCaps)
        );

        if (cancelled || !isMountedRef.current) {
          track.stop();
          return;
        }
        videoTrackRef.current = track;
        if (videoRef.current) track.attach(videoRef.current);

        // Background blur - DISABLED
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
    // gridAspectRatio and cameraHardwareCaps intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCamera, videoEnabled, qualityMode, stopPreview, backgroundBlur]);

  useEffect(() => {
    if (!isAudioOnlyMode(qualityMode)) {
      return;
    }

    stopPreview();
    setVideoEnabled(false);
  }, [qualityMode, stopPreview]);

  // Background blur toggle effect - DISABLED
  // useEffect(() => {
  //   ... blur toggle code removed ...
  // }, [backgroundBlur, videoEnabled]);

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
    blurActivating,
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
