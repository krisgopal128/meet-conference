import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { getToken, getGuestToken, createRoom, updateRoomSettings } from '../services/api';
import { useLightweightPreviewFilter } from '../hooks/useLightweightVideoFilter';
import { useBackgroundBlurPreview } from '../hooks/useBackgroundBlurPreview';
import { useMicLevelMeter } from '../hooks/useMicLevelMeter';
import { usePreJoinMedia } from '../hooks/usePreJoinMedia';
import { usePreJoinAuth } from '../hooks/usePreJoinAuth';
import { preInitBlurWorker } from '../utils/backgroundEffectsManager';
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
  Mic,
  Settings,
  ChevronDown,
  ChevronUp,
  Lock,
  User,
  ArrowRight,
  Check,
  RefreshCw,
  Copy,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  DeviceSettings,
  AudioSettings,
  VideoSettings,
} from '../components/prejoin';
import { setPendingTracks } from '../media/sharedTracks';

export default function PreJoinPage() {
  const { roomName } = useParams<{ roomName: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isCreateMode = searchParams.get('create') === 'true';

  const { room, isGuest, requestedRole, isAuthenticatedFromStore, user } = usePreJoinAuth({
    roomName,
    isCreateMode,
    searchParams,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      import('./RoomPage').catch(() => {});
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
    backgroundMode,
    setBackgroundMode,
    backgroundBgColor,
    setBackgroundBgColor,
    backgroundImagePath,
    setBackgroundImagePath,
    mirrorCamera,
    setMirrorCamera,
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
    expandedSections,
    toggleSection,
    initializing,
    initStatus,
    toggleVideo,
    stopPreview,
    detachPreview,
    getPreviewVideoTrack,
    markTracksTransferred,
  } = usePreJoinMedia({ roomName, isCreateMode });

  useEffect(() => {
    if (backgroundBlur) {
      preInitBlurWorker();
    }
  }, [backgroundBlur]);

  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingRoomEnabled, setWaitingRoomEnabled] = useState(true);
  const [error, setError] = useState('');
  const [showOptions, setShowOptions] = useState(false);

  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingRoomCode, setMeetingRoomCode] = useState(roomName || '');
  const [meetingPassword, setMeetingPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(false);

  async function handleJoin() {
    const targetRoomName = isCreateMode ? meetingRoomCode : roomName;
    if (!targetRoomName) return;

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
        const res = await getGuestToken(targetRoomName, displayName, password);
        token = res.data.token;
        inLobby = res.data.inLobby || false;
        role = res.data.role || 'attendee';
        hostId = res.data.hostId || null;

        if (res.data.wasPreviouslyAdmitted) {
          toast.success('Welcome back! You have been automatically readmitted.', {
            icon: '👋',
            duration: 4000,
          });
        }
      } else {
        const tokenRole = requestedRole === 'moderator' ? 'moderator' : 'attendee';
        const res = await getToken(targetRoomName, tokenRole);
        token = res.data.token;
        inLobby = res.data.inLobby || false;
        role = res.data.role || 'attendee';
        hostId = res.data.hostId || null;

        if (requestedRole === 'moderator') {
          try {
            await updateRoomSettings(targetRoomName, { gridAspectRatio, videoFitMode });
          } catch {
          }
        }
      }

      const videoTrack = videoEnabled && !isAudioOnlyMode(qualityMode)
        ? getPreviewVideoTrack()
        : null;

      let audioTrack: MediaStreamTrack | null = null;
      if (audioEnabled) {
        try {
          if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('getUserMedia not supported');
          }
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: selectedMic ? { exact: selectedMic } : undefined,
              noiseSuppression: { ideal: noiseSuppression },
              echoCancellation: { ideal: echoCancellation },
              autoGainControl: { ideal: true },
            },
          });
          audioTrack = audioStream.getAudioTracks()[0] || null;
        } catch {
        }
      }

      if (videoTrack || audioTrack) {
        detachPreview();
        markTracksTransferred();
        setPendingTracks(videoTrack, audioTrack);
      } else {
        stopPreview();
      }

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
          backgroundMode,
          backgroundBgColor,
          backgroundImagePath,
          mirrorCamera,
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

  const handleCopyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(meetingRoomCode);
      toast.success('Room code copied!');
    } catch {
      toast.error('Failed to copy');
    }
  };

  const effectiveName = isGuest ? displayName : (user?.name || displayName);
  const initials = effectiveName.charAt(0).toUpperCase() || '?';

  const showGuestFields = isGuest || (!isAuthenticatedFromStore && requestedRole === 'moderator' && !isCreateMode);
  const showModeratorLinkPrompt = !isAuthenticatedFromStore && requestedRole === 'moderator' && !isCreateMode;

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useLightweightPreviewFilter(videoElement, {
    enabled: videoFilter === 'lightweight' && videoEnabled && !backgroundBlur,
    blendFactor: 0.3,
    fitMode: videoFitMode,
  });

  useBackgroundBlurPreview(videoElement, {
    enabled: backgroundBlur && videoEnabled && backgroundMode !== 'none',
    mode: backgroundMode,
    blurRadius: backgroundBlurLevel,
    feather: 3,
    bgColor: backgroundBgColor,
    bgImage: backgroundImagePath ? (() => { const img = new Image(); img.src = backgroundImagePath; return img; })() : null,
  }, mirrorCamera, videoFitMode === 'contain' ? 'contain' : 'cover');

  useEffect(() => {
    setVideoElement(videoRef.current);
  }, [videoRef]);

  const micMeterFillRef = useRef<HTMLDivElement | null>(null);
  useMicLevelMeter(selectedMic, audioEnabled, micMeterFillRef, noiseSuppression, echoCancellation);

  const joinDisabled = loading || creatingRoom || (isCreateMode && !meetingRoomCode.trim()) || (showGuestFields && !displayName.trim());

  return (
    <div className="h-dvh bg-surface-50 dark:bg-surface-900 flex flex-col overscroll-none overflow-hidden">
      {/* Header */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 flex items-center justify-between border-b border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-surface-800 dark:text-white">Meet</span>
        </Link>
        <div className="text-sm text-surface-500 dark:text-surface-400 truncate max-w-[50%]">
          {isCreateMode ? 'Create Quick Meeting' : room?.title || 'Join Meeting'}
        </div>
      </header>

      {/* Centered content */}
      <div className="flex-1 flex items-start sm:items-center justify-center overflow-y-auto p-4 sm:p-6">
        <div className="w-full max-w-5xl flex flex-col gap-4 sm:gap-6">

          {/* Loading overlay — auto-requesting camera/mic permissions */}
          {initializing && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mb-4"></div>
              <p className="text-sm text-surface-600 dark:text-surface-400">{initStatus}</p>
            </div>
          )}

          {/* Content — always rendered (even during loading) */}
          {/* so videoRef.current is available when startPreview() attaches the stream */}
          <div className={initializing ? 'hidden' : 'flex flex-col lg:flex-row gap-4 sm:gap-6 w-full'}>

            {/* ── LEFT COLUMN: video preview + controls + devices ── */}
            <div className="flex-1 flex flex-col gap-4">
              <div
                className={cn(
                  'relative bg-surface-800 dark:bg-surface-950 rounded-2xl overflow-hidden shadow-xl w-full',
                  gridAspectRatio === '9:16' ? 'aspect-[9/16] max-w-xs' :
                  gridAspectRatio === '1:1' ? 'aspect-square max-w-lg' :
                  gridAspectRatio === '4:3' ? 'aspect-[4/3]' :
                  'aspect-video'
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
                      'w-full h-full',
                      mirrorCamera && 'scale-x-[-1]',
                      videoFitMode === 'contain' ? 'object-contain' : 'object-cover',
                      !videoEnabled && 'invisible'
                    )}
                  />
                </div>

                {!videoEnabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-700 to-surface-900">
                    <div className="text-center">
                      <div className="w-20 h-20 rounded-full bg-surface-600 flex items-center justify-center text-3xl font-bold text-surface-200 mx-auto mb-2">
                        {initials}
                      </div>
                      <p className="text-surface-400 text-sm">Camera is off</p>
                    </div>
                  </div>
                )}

                {/* Voice level meter */}
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
              </div>

              {/* Toggle buttons — Google Meet style */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                <button
                  onClick={() => setAudioEnabled(!audioEnabled)}
                  className={cn(
                    'flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm',
                    audioEnabled
                      ? 'bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-surface-600'
                      : 'bg-danger-500 text-white hover:bg-danger-600'
                  )}
                >
                  {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
                  <span>{audioEnabled ? 'Mic' : 'Muted'}</span>
                </button>

                <button
                  onClick={toggleVideo}
                  className={cn(
                    'flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm',
                    videoEnabled
                      ? 'bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-surface-600'
                      : 'bg-danger-500 text-white hover:bg-danger-600'
                  )}
                >
                  {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                  <span>{videoEnabled ? 'Camera' : 'Off'}</span>
                </button>

                <button
                  onClick={() => setShowOptions(!showOptions)}
                  className={cn(
                    'flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-full text-sm font-medium transition-all shadow-sm',
                    showOptions
                      ? 'bg-brand-500 text-white'
                      : 'bg-surface-200 dark:bg-surface-700 text-surface-700 dark:text-surface-200 hover:bg-surface-300 dark:hover:bg-surface-600'
                  )}
                >
                  <Settings size={18} />
                  <span>Options</span>
                  {showOptions ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Device selection — always visible */}
              <div className="w-full card p-4">
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
              </div>

            </div>{/* /left column */}

            {/* ── RIGHT COLUMN: name, password, join button ── */}
            <div className="w-full lg:w-80 xl:w-96 flex flex-col gap-4">

              {/* Error message */}
              {error && (
                <div className="w-full p-3 rounded-lg bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800">
                  <p className="text-sm text-danger-600 dark:text-danger-400">{error}</p>
                </div>
              )}

              {/* Moderator link prompt */}
              {showModeratorLinkPrompt && (
                <div className="w-full p-4 bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg">
                  <p className="text-sm text-warning-700 dark:text-warning-300">
                    This is a moderator link. Please sign in to continue as moderator, or join as a guest below.
                  </p>
                </div>
              )}

              {/* Create mode fields */}
              {isCreateMode && !isGuest && (
                <div className="w-full space-y-3">
                  <div>
                    <label htmlFor="meetingTitle" className="text-sm font-medium text-surface-600 dark:text-surface-300 mb-1 block">
                      Meeting Title
                    </label>
                    <input
                      id="meetingTitle"
                      value={meetingTitle}
                      onChange={e => setMeetingTitle(e.target.value)}
                      placeholder="e.g., Team Standup"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label htmlFor="meetingRoomCode" className="text-sm font-medium text-surface-600 dark:text-surface-300 mb-1 block">
                      Room Code
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="meetingRoomCode"
                        value={meetingRoomCode}
                        onChange={e => setMeetingRoomCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="room-code"
                        className="font-mono flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setMeetingRoomCode(generateRoomName())}
                        className="btn-secondary btn-icon shrink-0"
                        title="Generate new code"
                      >
                        <RefreshCw size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={handleCopyRoomCode}
                        className="btn-secondary btn-icon shrink-0"
                        title="Copy code"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="meetingPassword" className="text-sm font-medium text-surface-600 dark:text-surface-300 mb-1 block">
                      Password <span className="text-surface-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        id="meetingPassword"
                        type={showPassword ? 'text' : 'password'}
                        value={meetingPassword}
                        onChange={e => setMeetingPassword(e.target.value)}
                        placeholder="Leave empty for no password"
                        className="w-full pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-surface-700 dark:text-surface-200 flex items-center gap-2">
                        <Users size={14} />
                        Waiting Room
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">Participants wait until you admit them</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={waitingRoomEnabled}
                      onChange={e => setWaitingRoomEnabled(e.target.checked)}
                      className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
                    />
                  </label>
                </div>
              )}

              {/* Guest name + password */}
              {showGuestFields && (
                <div className="w-full space-y-3">
                  <div>
                    <label htmlFor="displayName" className="text-sm font-medium text-surface-600 dark:text-surface-300 mb-1 block">
                      Your Name
                    </label>
                    <div className="relative">
                      <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                      <input
                        id="displayName"
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        placeholder="Enter your name"
                        required
                        className="w-full pl-10"
                        onKeyDown={e => { if (e.key === 'Enter' && !joinDisabled) handleJoin(); }}
                      />
                    </div>
                  </div>
                  {room && (
                    <div>
                      <label htmlFor="password" className="text-sm font-medium text-surface-600 dark:text-surface-300 mb-1 block">
                        Room Password <span className="text-surface-400 font-normal">(if required)</span>
                      </label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
                        <input
                          id="password"
                          type="password"
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full pl-10"
                          onKeyDown={e => { if (e.key === 'Enter' && !joinDisabled) handleJoin(); }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Signed-in status */}
              {!showGuestFields && !isCreateMode && (
                <div className="flex items-center gap-3 px-4 py-3 bg-brand-50 dark:bg-brand-900/20 rounded-full">
                  <div className="w-8 h-8 bg-brand-500 rounded-full flex items-center justify-center">
                    <Check size={16} className="text-white" />
                  </div>
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200">
                    Signed in as {(user?.role === 'admin' || user?.role === 'moderator' || requestedRole === 'moderator') ? 'Moderator' : 'Participant'}
                  </p>
                </div>
              )}

              {/* Join button */}
              <button
                onClick={handleJoin}
                disabled={joinDisabled}
                className="flex items-center gap-2 px-8 py-3.5 rounded-full bg-brand-500 text-white text-base font-semibold shadow-lg hover:bg-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creatingRoom ? (
                  <span>Creating Room...</span>
                ) : loading ? (
                  <span>{isCreateMode ? 'Starting...' : 'Joining...'}</span>
                ) : (
                  <>
                    <span>{isCreateMode ? 'Start Meeting' : 'Join Now'}</span>
                    <ArrowRight size={20} />
                  </>
                )}
              </button>

              {/* Advanced Options — collapsible */}
              {showOptions && (
                <div className="w-full max-h-[50vh] overflow-y-auto card p-4 space-y-4 animate-fade-in">
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
                    backgroundMode={backgroundMode}
                    backgroundBgColor={backgroundBgColor}
                    backgroundImagePath={backgroundImagePath}
                    mirrorCamera={mirrorCamera}
                    isGuest={isGuest}
                    onAspectRatioChange={setGridAspectRatio}
                    onVideoFitModeChange={setVideoFitMode}
                    onVideoFilterChange={setVideoFilter}
                    onBackgroundBlurChange={setBackgroundBlur}
                    onBackgroundBlurLevelChange={setBackgroundBlurLevel}
                    onBackgroundModeChange={setBackgroundMode}
                    onBackgroundBgColorChange={setBackgroundBgColor}
                    onBackgroundImagePathChange={setBackgroundImagePath}
                    onMirrorCameraChange={setMirrorCamera}
                    isExpanded={expandedSections.video}
                    onToggle={() => toggleSection('video')}
                  />

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
                                    {mode === 'dataSaver' ? 'Data Saver' :
                                     mode === 'highQuality' ? 'High Quality' :
                                     mode === 'audioOnly' ? 'Audio Only' : 'Auto'}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
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
                          {isCreateMode && (
                            <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5 cursor-pointer">
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
            </div>{/* /right column */}
          </div>{/* /content */}
        </div>
      </div>
    </div>
  );
}
