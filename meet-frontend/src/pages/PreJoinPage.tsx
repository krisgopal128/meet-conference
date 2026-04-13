import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { createLocalVideoTrack, LocalVideoTrack } from 'livekit-client';
import { getToken, getGuestToken, getRoom, createRoom, updateRoomSettings } from '../services/api';
import { useIsAuthenticated, useUser } from '../store/authStore';
import { useLightweightPreviewFilter } from '../hooks/useLightweightVideoFilter';
import type { Room } from '../types';
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
import { cn } from '../utils/cn';
import { generateRoomName } from '../utils/roomName';
import { isValidRoomName } from '../utils/security';
import toast from 'react-hot-toast';
import {
  Video,
  MicOff,
  VideoOff,
  ArrowRight,
  User,
  Lock,
  Check,
  Edit3,
  RefreshCw,
  Copy,
  Grid3X3,
  Users,
} from 'lucide-react';
import {
  DeviceSettings,
  AudioSettings,
  VideoSettings,
  PreJoinControls,
  type DeviceList,
} from '../components/prejoin';

export default function PreJoinPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoTrackRef = useRef<LocalVideoTrack | null>(null);
  const permissionStreamRef = useRef<MediaStream | null>(null);
  const permissionVideoTrackRef = useRef<MediaStreamTrack | null>(null); // Reuse for preview
  const isMountedRef = useRef(true);
  const hasRequestedPermissionsRef = useRef(false);

  // Check if this is a "create new meeting" flow
  const isCreateMode = searchParams.get('create') === 'true';

  const [room, setRoom] = useState<Room | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(meetingRoomConfig.prejoin.videoEnabledByDefault);
  const [audioEnabled, setAudioEnabled] = useState(meetingRoomConfig.prejoin.audioEnabledByDefault);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  // Use zustand hook for auth state - this properly handles hydration
  const isAuthenticatedFromStore = useIsAuthenticated();
  const user = useUser();
  const [loading, setLoading] = useState(false);
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
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [error, setError] = useState('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(meetingRoomConfig.prejoin.showDeviceSettingsByDefault);
  const [initializing, setInitializing] = useState(true);
  const [initStatus, setInitStatus] = useState('Loading...');

  // Camera hardware capabilities (detected from actual device)
  const [cameraHardwareCaps, setCameraHardwareCaps] = useState<CameraHardwareCaps | null>(null);

  // Track if we've auto-selected aspect ratio based on camera (do once per camera)
  const aspectRatioAutoSelectedRef = useRef(false);

  // Role from URL query parameter (for moderator/guest links from Tuition Notebook)
  const requestedRole = searchParams.get('role') as 'moderator' | 'guest' | null;
  
  // Auto-set guest mode based on role parameter
  // If ?role=guest is in URL → force guest mode (even if authenticated)
  // If ?role=moderator is in URL → ensure authenticated mode
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (requestedRole === 'guest') return true;
    if (requestedRole === 'moderator') return false;
    return true; // default to guest
  });

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

    console.log(`📷 Native ratio ${nativeRatio.toFixed(3)} → closest: ${closest.ratio} (${closest.value.toFixed(3)})`);
    return closest.ratio;
  }, []);

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

  // Create mode state - for moderators creating new meetings
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingRoomCode, setMeetingRoomCode] = useState(roomName || '');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

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

  useEffect(() => {
    isMountedRef.current = true;
    
    // Check for token parameter - teacher one-click join
    const tokenParam = searchParams.get('t');
    const roleParam = searchParams.get('role');
    if (tokenParam && roomName) {
      console.log('[PreJoin] Token found in URL, redirecting to room...');
      // Store token in sessionStorage for RoomPage to use
      sessionStorage.setItem(`token_${roomName}`, tokenParam);
      // Store role in sessionStorage as well (for moderator links)
      if (roleParam === 'moderator') {
        sessionStorage.setItem(`role_${roomName}`, roleParam);
      }
      // Navigate directly to room
      navigate(`/room/${roomName}`, { replace: true });
      return;
    }
    
    // Update isGuest based on zustand store (which handles hydration)
    // BUT respect role parameter: if role=moderator, don't allow guest mode
    if (requestedRole === 'moderator' && !isAuthenticatedFromStore) {
      // Moderator role requested but user not logged in - will show login prompt
      setIsGuest(false);
    } else {
      setIsGuest(!isAuthenticatedFromStore);
    }

    // Set initial room code from URL param
    if (roomName) {
      setMeetingRoomCode(roomName);
    }

    // Only fetch room if not in create mode
    if (roomName && !isCreateMode) {
      setInitStatus('Loading room info...');
      getRoom(roomName)
        .then((r) => {
          if (!r.data?.room) {
            // Room doesn't exist - redirect to 404
            navigate('/404', { replace: true });
            return;
          }
          setRoom(r.data.room);
        })
        .catch(() => {
          // Room not found - redirect to 404
          navigate('/404', { replace: true });
        });
    }

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
        console.error('Failed to get permissions:', e);
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
          console.error('Video permission denied:', videoError);
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
  }, [roomName, isCreateMode, stopPermissionStream, stopPreview, isAuthenticatedFromStore, navigate]);

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

  async function loadDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices({
        cameras: all.filter((d) => d.kind === 'videoinput'),
        mics: all.filter((d) => d.kind === 'audioinput'),
        speakers: all.filter((d) => d.kind === 'audiooutput'),
      });
    } catch (e) {
      console.error('Failed to enumerate devices:', e);
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
            console.log(`📷 Auto-selected aspect ratio: ${nativeRatio} (native: ${caps.nativeAspectRatio.toFixed(3)})`);
          }
        }
      }

      let track: LocalVideoTrack;

      // Reuse existing track if provided (optimization: avoids 2nd getUserMedia call)
      if (reuseTrack && reuseTrack.readyState === 'live') {
        console.log('📷 Reusing permission video track for preview (1 request optimization)');
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
      console.error('Failed to start video preview:', e);
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
        console.error('Failed to start video preview:', e);
        toast.error('Could not start camera');
      }
    }
    // gridAspectRatio and cameraHardwareCaps intentionally omitted - changes would cause unnecessary re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoEnabled, selectedCamera, qualityMode, stopPreview]);

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
        console.log(`📷 Camera changed - auto-selected aspect ratio: ${nativeRatio}`);

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
      console.error('Failed to switch camera:', error);
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

  async function handleJoin() {
    const targetRoomName = isCreateMode ? meetingRoomCode : roomName;
    if (!targetRoomName) return;

    // Security: Validate room name to prevent injection attacks
    if (!isValidRoomName(targetRoomName)) {
      setError('Invalid room name. Use only letters, numbers, hyphens, and underscores.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let token: string;
      let inLobby = false;
      let role = 'attendee';
      let hostId: string | null = null;

      // If in create mode and authenticated, create the room first
      if (isCreateMode && !isGuest) {
        setCreatingRoom(true);
        try {
          await createRoom({
            title: meetingTitle || 'Quick Meeting',
            name: meetingRoomCode,
            waitingRoomEnabled,
          });
        } catch (err: unknown) {
          const axiosErr = err as { response?: { data?: { error?: string } } };
          // Room might already exist, continue to join
          if (!axiosErr.response?.data?.error?.includes('already exists')) {
            setError(axiosErr.response?.data?.error || 'Failed to create room');
            setLoading(false);
            setCreatingRoom(false);
            return;
          }
        }
        setCreatingRoom(false);
      }

      if (isGuest) {
        if (!displayName.trim()) {
          setError('Please enter your name');
          setLoading(false);
          return;
        }
        // Guest always gets attendee role (no moderator permission for guests)
        const res = await getGuestToken(targetRoomName, displayName, password);
        token = res.data.token;
        inLobby = res.data.inLobby || false;
        role = res.data.role || 'attendee';
        hostId = res.data.hostId || null;

        // Show toast notification for auto-admitted rejoining participants
        if (res.data.wasPreviouslyAdmitted) {
          toast.success('Welcome back! You have been automatically readmitted.', {
            icon: '👋',
            duration: 4000,
          });
        }
      } else {
        // For authenticated users, pass the requested role if specified in URL
        // This allows moderator links to work for logged-in users
        const tokenRole = requestedRole === 'moderator' ? 'moderator' : 'attendee';
        const res = await getToken(targetRoomName, tokenRole);
        token = res.data.token;
        inLobby = false;
        role = res.data.role || 'attendee';
        hostId = res.data.hostId || null;

        // Save grid aspect ratio to room settings (moderator only)
        try {
          await updateRoomSettings(targetRoomName, { gridAspectRatio, videoFitMode });
        } catch {
          // Ignore errors - not critical if this fails
        }
      }

      stopPreview();

      navigate(`/room/${targetRoomName}`, {
        state: {
          token,
          videoEnabled,
          audioEnabled,
          selectedCamera,
          selectedMic,
          selectedSpeaker,
          micLevel,
          speakerLevel,
          noiseSuppression,
          echoCancellation,
          backgroundBlur,
          videoFilter,
          qualityMode,
          screenShareMode,
          gridAspectRatio,
          videoFitMode,
          cameraHardwareCaps,
          inLobby,
          hostId: hostId || room?.host_id || null,
          role,
          displayName: isGuest ? displayName : user?.name || '',
        },
      });
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      setError(axiosErr.response?.data?.error || 'Failed to join room. Check the room name or password.');
    } finally {
      setLoading(false);
    }
  }

  // Copy room code to clipboard
  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(meetingRoomCode);
      toast.success('Room code copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const initials = displayName.charAt(0).toUpperCase() || '?';

  // Apply lightweight video filter to preview
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useLightweightPreviewFilter(videoElement, {
    enabled: videoFilter === 'lightweight' && videoEnabled,
    blendFactor: 0.3,
    fitMode: videoFitMode,
  });

  // Update video element ref - runs once on mount
  useEffect(() => {
    setVideoElement(videoRef.current);
  }, []);

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col sm:flex-row">
      {/* Left side - Preview */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-16 px-6 flex items-center justify-between border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Video className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-surface-800 dark:text-white">Meet</span>
          </Link>
          <div className="text-sm text-surface-500 dark:text-surface-400">
            {isCreateMode ? 'Create Quick Meeting' : room?.title || 'Join Meeting'}
          </div>
        </header>

        {/* Preview area */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
          {/* Loading overlay */}
          {initializing && (
            <div className="absolute inset-0 bg-surface-50 dark:bg-surface-900 flex items-center justify-center z-50">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-surface-600 dark:text-surface-400">{initStatus}</p>
              </div>
            </div>
          )}

          <div className="w-full max-w-2xl">
            {/* Video preview */}
            <div
              className={cn(
                'relative bg-surface-800 dark:bg-surface-950 rounded-xl overflow-hidden shadow-lg transition-all duration-300',
                gridAspectRatio === '16:9'
                  ? 'aspect-video'
                  : gridAspectRatio === '9:16'
                    ? 'aspect-[9/16] max-w-xs mx-auto'
                    : gridAspectRatio === '1:1'
                      ? 'aspect-square max-w-md mx-auto'
                      : 'aspect-[4/3]'
              )}
            >
              <div
                className={cn(
                  'absolute inset-0 overflow-hidden',
                  videoFitMode === 'contain' && 'bg-black'
                )}
              >
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ objectPosition: 'center' }}
                  className={cn(
                    'w-full h-full scale-x-[-1]',
                    videoFitMode === 'contain' ? 'object-contain' : 'object-cover',
                    !videoEnabled && 'invisible'
                  )}
                />
              </div>
              {!videoEnabled && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 rounded-full bg-surface-700 flex items-center justify-center text-4xl font-bold text-surface-300 mx-auto mb-3">
                      {initials}
                    </div>
                    <p className="text-surface-400">Camera is off</p>
                  </div>
                </div>
              )}

              {/* Blur activation overlay */}
              {blurActivating && (
                <div className="absolute inset-0 bg-surface-900/50 flex items-center justify-center z-5">
                  <div className="text-center">
                    <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
                    <p className="text-white text-sm font-medium">Applying blur...</p>
                  </div>
                </div>
              )}

              {/* Video overlay controls */}
              <PreJoinControls
                videoEnabled={videoEnabled}
                audioEnabled={audioEnabled}
                gridAspectRatio={gridAspectRatio}
                onToggleVideo={toggleVideo}
                onToggleAudio={() => setAudioEnabled(!audioEnabled)}
                onToggleSettings={() => setShowDeviceSettings(!showDeviceSettings)}
              />
            </div>

            {/* Device settings panel */}
            {showDeviceSettings && (
              <div className="mt-4 card p-4 animate-fade-in space-y-4">
                <DeviceSettings
                  devices={devices}
                  selectedCamera={selectedCamera}
                  selectedMic={selectedMic}
                  selectedSpeaker={selectedSpeaker}
                  micLevel={micLevel}
                  speakerLevel={speakerLevel}
                  onCameraChange={setSelectedCamera}
                  onMicChange={setSelectedMic}
                  onSpeakerChange={setSelectedSpeaker}
                  onMicLevelChange={setMicLevel}
                  onSpeakerLevelChange={setSpeakerLevel}
                  isExpanded={expandedSections.devices}
                  onToggle={() => toggleSection('devices')}
                />

                <AudioSettings
                  noiseSuppression={noiseSuppression}
                  echoCancellation={echoCancellation}
                  onNoiseSuppressionChange={setNoiseSuppression}
                  onEchoCancellationChange={setEchoCancellation}
                  isExpanded={expandedSections.audio}
                  onToggle={() => toggleSection('audio')}
                />

                <VideoSettings
                  gridAspectRatio={gridAspectRatio}
                  videoFitMode={videoFitMode}
                  videoFilter={videoFilter}
                  isGuest={isGuest}
                  onAspectRatioChange={setGridAspectRatio}
                  onVideoFitModeChange={setVideoFitMode}
                  onVideoFilterChange={setVideoFilter}
                  isExpanded={expandedSections.video}
                  onToggle={() => toggleSection('video')}
                />

                {/* Meeting Settings Section - Moderators only */}
                {!isGuest && (
                  <div>
                    <button
                      type="button"
                      onClick={() => toggleSection('moderator')}
                      className="flex items-center justify-between w-full text-left"
                    >
                      <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
                        <Users size={14} />
                        Meeting Settings
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400">
                          Host
                        </span>
                      </h3>
                      <span className="text-xs text-surface-400">
                        {expandedSections.moderator ? '▼' : '▶'}
                      </span>
                    </button>
                    {expandedSections.moderator && (
                      <div className="mt-3 space-y-3">
                        {/* Video Quality - Moderators only */}
                        {meetingRoomConfig.features.qualityModeSelector && (
                          <div>
                            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">
                              Quality Mode
                            </label>
                            <select
                              value={qualityMode}
                              onChange={(e) => setQualityMode(e.target.value as QualityModeName)}
                              className="text-sm"
                            >
                              {meetingRoomConfig.qualityModes.availableModes.map((mode) => (
                                <option key={mode} value={mode}>
                                  {mode === 'dataSaver'
                                    ? 'Data Saver'
                                    : mode === 'highQuality'
                                      ? 'High Quality'
                                      : mode === 'audioOnly'
                                        ? 'Audio Only'
                                        : 'Auto'}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        {/* Default Screenshare Mode - Moderators only */}
                        {meetingRoomConfig.features.screenshareModeSelector && (
                          <div>
                            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">
                              Default Screenshare Mode
                            </label>
                            <select
                              value={screenShareMode}
                              onChange={(e) => setScreenShareMode(e.target.value as ScreenShareModeName)}
                              className="text-sm"
                            >
                              <option value="documents">Documents / Slides</option>
                              <option value="motion">Motion / Video</option>
                            </select>
                          </div>
                        )}
                        {/* Waiting Room - Moderators only (create mode) */}
                        {isCreateMode && (
                          <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5">
                            <div>
                              <p className="text-sm font-medium text-surface-700 dark:text-surface-200 flex items-center gap-2">
                                <Users size={14} />
                                Waiting Room
                              </p>
                              <p className="text-xs text-surface-500 dark:text-surface-400">
                                Participants wait until you admit them
                              </p>
                            </div>
                            <input
                              type="checkbox"
                              checked={waitingRoomEnabled}
                              onChange={(e) => setWaitingRoomEnabled(e.target.checked)}
                              className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side - Join panel */}
      <div className="w-full sm:w-96 bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 flex flex-col border-t sm:border-t-0 sm:border-l">
        <div className="flex-1 flex flex-col justify-center p-4 sm:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-surface-800 dark:text-white mb-2">
              {isCreateMode ? 'Quick Meeting' : room?.title || 'Join Meeting'}
            </h1>
            {!isCreateMode && (
              <p className="text-surface-500 dark:text-surface-400 text-sm">
                Room: <span className="font-mono truncate">{roomName}</span>
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
              <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
            </div>
          )}

          {/* Create mode - Moderator settings */}
          {isCreateMode && !isGuest && (
            <div className="space-y-4 mb-6">
              {/* Meeting Title */}
              <div>
                <label htmlFor="meetingTitle" className="flex items-center gap-2">
                  <Edit3 size={14} className="text-surface-400" />
                  Meeting Title
                </label>
                <input
                  id="meetingTitle"
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="e.g., Team Standup"
                  className="mt-1"
                />
              </div>

              {/* Room Code */}
              <div>
                <label htmlFor="meetingRoomCode" className="flex items-center gap-2">
                  <Video size={14} className="text-surface-400" />
                  Room Code
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    id="meetingRoomCode"
                    value={meetingRoomCode}
                    onChange={(e) =>
                      setMeetingRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }
                    placeholder="room-code"
                    className="font-mono flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setMeetingRoomCode(generateRoomName())}
                    className="btn-secondary btn-icon"
                    title="Generate new code"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyRoomCode}
                    className="btn-secondary btn-icon"
                    title="Copy code"
                  >
                    <Copy size={16} />
                  </button>
                </div>
                <p className="text-xs text-surface-400 mt-1">Share this code with participants</p>
              </div>

              {/* Password (Optional) */}
              <div>
                <label htmlFor="meetingPassword" className="flex items-center gap-2">
                  <Lock size={14} className="text-surface-400" />
                  Password <span className="text-surface-400 font-normal">(optional)</span>
                </label>
                <div className="relative mt-1">
                  <input
                    id="meetingPassword"
                    type={showPassword ? 'text' : 'password'}
                    value={meetingPassword}
                    onChange={(e) => setMeetingPassword(e.target.value)}
                    placeholder="Leave empty for no password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                  >
                    {showPassword ? <VideoOff size={16} /> : <Video size={16} />}
                  </button>
                </div>
                <p className="text-xs text-surface-400 mt-1">Protect your meeting with a password</p>
              </div>
            </div>
          )}

          {/* Guest form */}
          {!isAuthenticatedFromStore && !isGuest && !isCreateMode ? (
            <div className="space-y-4">
              <div className="p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                <p className="text-sm text-warning-700 dark:text-warning-300">
                  This is a moderator link. Please sign in to continue as moderator, or you can join as a guest below.
                </p>
              </div>
              <div>
                <label htmlFor="displayName">Your Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              {room && (
                <div>
                  <label htmlFor="password">Room Password (if required)</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : isGuest ? (
            <div className="space-y-4">
              <div>
                <label htmlFor="displayName">Your Name</label>
                <div className="relative">
                  <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                  <input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Enter your name"
                    required
                    className="pl-10"
                  />
                </div>
              </div>
              {room && (
                <div>
                  <label htmlFor="password">Room Password (if required)</label>
                  <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="pl-10"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : !isAuthenticatedFromStore && !isCreateMode ? (
            <div className="flex items-center gap-3 p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <div className="w-10 h-10 bg-brand-500 rounded-full flex items-center justify-center">
                <Check size={20} className="text-white" />
              </div>
              <div>
                <p className="font-medium text-surface-800 dark:text-white">Signed in</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">You'll join as a moderator</p>
              </div>
            </div>
          ) : null}

          {/* Ready status */}
          <div className="mt-6 p-4 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
            <h4 className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3">Ready to join?</h4>
            <div className="flex flex-wrap gap-3">
              <div
                className={cn(
                  'flex items-center gap-2 text-sm',
                  videoEnabled && !isAudioOnlyMode(qualityMode)
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-danger-500'
                )}
              >
                {videoEnabled && !isAudioOnlyMode(qualityMode) ? <Check size={16} /> : <VideoOff size={16} />}
                <span>Camera {videoEnabled && !isAudioOnlyMode(qualityMode) ? 'on' : 'off'}</span>
              </div>
              <div
                className={cn(
                  'flex items-center gap-2 text-sm',
                  audioEnabled ? 'text-success-600 dark:text-success-400' : 'text-danger-500'
                )}
              >
                {audioEnabled ? <Check size={16} /> : <MicOff size={16} />}
                <span>Microphone {audioEnabled ? 'on' : 'off'}</span>
              </div>
              {/* Video filter status - All users */}
              {videoFilter === 'lightweight' && (
                <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                  <Check size={16} />
                  <span>Filter on</span>
                </div>
              )}
              {/* Aspect Ratio - All authenticated users */}
              {!isGuest && (
                <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                  <Grid3X3 size={16} />
                  <span>Ratio: {gridAspectRatio}</span>
                </div>
              )}
              {/* Quality Mode - Moderators only */}
              {!isGuest && (
                <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                  <Check size={16} />
                  <span>
                    Mode:{' '}
                    {qualityMode === 'dataSaver'
                      ? 'Data Saver'
                      : qualityMode === 'highQuality'
                        ? 'High Quality'
                        : qualityMode === 'audioOnly'
                          ? 'Audio Only'
                          : 'Auto'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Join/Create button */}
          <button
            onClick={handleJoin}
            disabled={
              loading ||
              creatingRoom ||
              (isGuest && !displayName.trim()) ||
              (isCreateMode && !meetingRoomCode.trim())
            }
            className="btn-primary w-full mt-6"
          >
            {creatingRoom ? (
              <span>Creating Room...</span>
            ) : loading ? (
              <span>{isCreateMode ? 'Starting...' : 'Joining...'}</span>
            ) : (
              <>
                <span>{isCreateMode ? 'Start Meeting' : 'Join Now'}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
