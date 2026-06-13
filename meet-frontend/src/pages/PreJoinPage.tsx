import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { getToken, getGuestToken, createRoom, updateRoomSettings } from '../services/api';
import { useLightweightPreviewFilter } from '../hooks/useLightweightVideoFilter';
import { useBackgroundBlurPreview } from '../hooks/useBackgroundBlurPreview';
import { useMicLevelMeter } from '../hooks/useMicLevelMeter';
import { usePreJoinMedia } from '../hooks/usePreJoinMedia';
import { usePreJoinAuth } from '../hooks/usePreJoinAuth';
import {
  isAudioOnlyMode,
  meetingRoomConfig,
  type QualityModeName,
  type ScreenShareModeName,
} from '../config/meetingRoomConfig';
import { cn } from '../utils/cn';
import { generateRoomName } from '../utils/roomName';
import { isValidRoomName } from '../utils/security';
import toast from 'react-hot-toast';
import {
  Video,
  MicOff,
  VideoOff,
  Check,
  Grid3X3,
  Users,
  Mic,
} from 'lucide-react';
import {
  DeviceSettings,
  AudioSettings,
  VideoSettings,
  PreJoinControls,
  CreateMeetingForm,
  JoinForm,
} from '../components/prejoin';

export default function PreJoinPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Check if this is a "create new meeting" flow
  const isCreateMode = searchParams.get('create') === 'true';

  const { room, isGuest, requestedRole, isAuthenticatedFromStore, user } = usePreJoinAuth({
    roomName,
    isCreateMode,
    searchParams,
  });

  // Prefetch the RoomPage chunk (livekit + vendor) while user is on PreJoin
  // so clicking "Join" doesn't trigger a 800KB+ download delay
  useEffect(() => {
    const timer = setTimeout(() => {
      import('./RoomPage').catch(() => { /* prefetch failure is non-critical */ });
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const {
    videoRef,
    videoEnabled,
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
    toggleVideo,
    stopPreview,
  } = usePreJoinMedia({ roomName, isCreateMode });

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [error, setError] = useState('');

  // Create mode state - for moderators creating new meetings
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingRoomCode, setMeetingRoomCode] = useState(roomName || '');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

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
            password: meetingPassword || undefined,
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
        inLobby = res.data.inLobby || false;
        role = res.data.role || 'attendee';
        hostId = res.data.hostId || null;

        // Save grid aspect ratio to room settings (moderator only)
        if (requestedRole === 'moderator') {
          try {
            await updateRoomSettings(targetRoomName, { gridAspectRatio, videoFitMode });
          } catch {
            // Ignore errors - not critical if this fails
          }
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
          backgroundBlurLevel,
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
    enabled: videoFilter === 'lightweight' && videoEnabled && !backgroundBlur,
    blendFactor: 0.3,
    fitMode: videoFitMode,
  });

  useBackgroundBlurPreview(videoElement, {
    enabled: backgroundBlur && videoEnabled,
    mode: 'blur',
    blurRadius: backgroundBlurLevel,
    feather: 3,
    bgColor: '#1e1e2e',
    bgImage: null,
  });

  // Update video element ref - runs once on mount
  useEffect(() => {
    setVideoElement(videoRef.current);
  }, [videoRef]);

  // Voice level meter — tracks selected mic input in real time
  const micMeterFillRef = useRef<HTMLDivElement | null>(null);
  useMicLevelMeter(selectedMic, audioEnabled, micMeterFillRef);

  return (
    <div className="min-h-screen min-h-dvh bg-surface-50 dark:bg-surface-900 flex flex-col sm:flex-row overscroll-none">
      {/* Left side - Preview */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
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
            <div className="absolute inset-0 bg-surface-50 dark:bg-surface-900 flex items-center justify-center z-50 p-4">
              <div className="text-center">
                <div className="w-10 h-10 sm:w-12 sm:h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mx-auto mb-3 sm:mb-4"></div>
                <p className="text-sm sm:text-base text-surface-600 dark:text-surface-400">{initStatus}</p>
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
                style={{ touchAction: 'manipulation', WebkitTouchCallout: 'none' }}
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

              {/* Voice level meter overlay */}
              <div
                className={cn(
                  'absolute left-3 bottom-3 flex items-center gap-2 rounded-full px-2.5 py-1.5 z-10 transition-opacity duration-200',
                  audioEnabled
                    ? 'bg-black/55 backdrop-blur-sm opacity-100'
                    : 'opacity-0 pointer-events-none'
                )}
              >
                <Mic className="w-3.5 h-3.5 text-white/70 shrink-0" />
                <div className="w-20 h-1.5 rounded-full bg-white/15 overflow-hidden">
                  <div
                    ref={micMeterFillRef}
                    className="h-full w-0 rounded-full transition-[width] duration-75"
                    style={{ background: 'linear-gradient(90deg, #37d67a, #fbbf24 60%, #ef4444)' }}
                  />
                </div>
              </div>

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
              <div className="mt-3 sm:mt-4 card p-3 sm:p-4 animate-fade-in space-y-3 sm:space-y-4 max-h-[50vh] overflow-y-auto">
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
                  backgroundBlur={backgroundBlur}
                  backgroundBlurLevel={backgroundBlurLevel}
                  isGuest={isGuest}
                  onAspectRatioChange={setGridAspectRatio}
                  onVideoFitModeChange={setVideoFitMode}
                  onVideoFilterChange={setVideoFilter}
                  onBackgroundBlurChange={setBackgroundBlur}
                  onBackgroundBlurLevelChange={setBackgroundBlurLevel}
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
        <div className="flex-1 flex flex-col justify-center p-4 sm:p-6 overflow-y-auto max-h-[60vh] sm:max-h-none">
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
            <CreateMeetingForm
              meetingTitle={meetingTitle}
              meetingRoomCode={meetingRoomCode}
              meetingPassword={meetingPassword}
              showPassword={showPassword}
              waitingRoomEnabled={waitingRoomEnabled}
              onTitleChange={setMeetingTitle}
              onRoomCodeChange={setMeetingRoomCode}
              onPasswordChange={setMeetingPassword}
              onShowPasswordToggle={() => setShowPassword(!showPassword)}
              onWaitingRoomChange={setWaitingRoomEnabled}
              onGenerateRoomCode={() => setMeetingRoomCode(generateRoomName())}
              onCopyRoomCode={handleCopyRoomCode}
            />
          )}

          <JoinForm
            showGuestFields={isGuest || (!isAuthenticatedFromStore && requestedRole === 'moderator' && !isCreateMode)}
            showModeratorLinkPrompt={!isAuthenticatedFromStore && requestedRole === 'moderator' && !isCreateMode}
            isCreateMode={isCreateMode}
            displayName={displayName}
            password={password}
            room={room}
            loading={loading}
            creatingRoom={creatingRoom}
            disabled={isCreateMode && !meetingRoomCode.trim()}
            onDisplayNameChange={setDisplayName}
            onPasswordChange={setPassword}
            onJoin={handleJoin}
          />

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
              {/* Background blur status */}
              {backgroundBlur && (
                <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                  <Check size={16} />
                  <span>Background blur on</span>
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

        </div>
      </div>
    </div>
  );
}
