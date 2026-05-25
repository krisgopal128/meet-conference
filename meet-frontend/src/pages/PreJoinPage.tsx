import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { getToken, getGuestToken, createRoom, updateRoomSettings } from '../services/api';
import { useLightweightPreviewFilter } from '../hooks/useLightweightVideoFilter';
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
  }, [videoRef]);

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
