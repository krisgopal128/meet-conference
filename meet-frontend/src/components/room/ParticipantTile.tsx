import { memo, useEffect, useRef, useState, Component, ReactNode } from 'react';
import { Track, ParticipantEvent, ConnectionQuality, type RemoteTrackPublication, type Participant } from 'livekit-client';
import {
  VideoTrack,
  ParticipantName,
  useIsSpeaking,
  useConnectionQualityIndicator,
} from '@livekit/components-react';
import {
  useHasRaisedHand,
  usePinnedIdentity,
  useMirrorLocalVideo,
  useFeatureActions,
  useHostId,
  useLayout,
  useQualityMode,
  useVideoFitMode,
  useSelectedQualityMode,
  useQualityOverrideReason,
  useDisplayName,
} from '../../store/roomStore';
import { Pin, Hand, Mic, MicOff, Maximize, Minimize, Crop, Square } from 'lucide-react';
import {
  isAudioOnlyMode,
  meetingRoomConfig,
  resolveTileTargetLayer,
  resolveVideoQuality,
} from '../../config/meetingRoomConfig';
import { useParticipantVisibility } from '../../contexts/ParticipantVisibilityContext';
import { useRoomCameraTrack } from '../../contexts/RoomCameraTracksContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import logger from '../../utils/logger';
import toast from 'react-hot-toast';

interface ParticipantTileProps {
  participant: Participant;
  className?: string;
  isSpeakerTile?: boolean; // true = main speaker in speaker layout, false = filmstrip
  participantCount?: number;
}

// Custom signal bars indicator (4 bars, fills based on quality)
function SignalBars({ quality }: { quality: ConnectionQuality }) {
  const getBarHeights = () => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return ['25%', '50%', '75%', '100%'];
      case ConnectionQuality.Good:
        return ['25%', '50%', '75%', '0%'];
      case ConnectionQuality.Poor:
        return ['25%', '50%', '0%', '0%'];
      case ConnectionQuality.Lost:
      default:
        return ['25%', '0%', '0%', '0%'];
    }
  };

  const getColor = () => {
    switch (quality) {
      case ConnectionQuality.Excellent:
        return 'bg-green-500';
      case ConnectionQuality.Good:
        return 'bg-yellow-500';
      case ConnectionQuality.Poor:
        return 'bg-orange-500';
      case ConnectionQuality.Lost:
      default:
        return 'bg-red-500';
    }
  };

  const heights = getBarHeights();
  const color = getColor();

  return (
    <div className="flex items-end gap-[2px] h-3">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] ${h !== '0%' ? color : 'bg-white/30'} rounded-[1px]`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function ParticipantTileInner({ participant, className = '', isSpeakerTile = true, participantCount }: ParticipantTileProps) {
  // Optimized selectors
  const hasRaisedHand = useHasRaisedHand(participant.identity);
  const pinnedIdentity = usePinnedIdentity();
  const mirrorLocalVideo = useMirrorLocalVideo();
  const localDisplayName = useDisplayName();
  
  // Action hooks
  const { setPinned } = useFeatureActions();
  
  // Phase 2: Visibility context for participant culling and tab optimization
  // Always call the hook - it returns safe defaults when outside provider
  const visibilityContext = useParticipantVisibility();
  
  const isSpeaking = useIsSpeaking(participant);
  const { quality: connectionQuality } = useConnectionQualityIndicator({ participant });
  const qualityMode = useQualityMode();
  const videoFitMode = useVideoFitMode();
  const selectedQualityMode = useSelectedQualityMode();
  const qualityOverrideReason = useQualityOverrideReason();
  const isPinned = pinnedIdentity === participant.identity;
  const tileRef = useRef<HTMLDivElement>(null);
  const hostId = useHostId();
  const layout = useLayout();
  const isMobile = useIsMobile();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isVideoPaused, setIsVideoPaused] = useState(false);

  const cameraTrackRef = useRoomCameraTrack(participant.identity);
  
  // Get track SID for key to VideoTrack
  const trackSid = cameraTrackRef?.publication?.trackSid;
  
  // Force re-render when track state changes
  const [, forceRender] = useState(0);

  // ========================================
  // CRITICAL FIX: Force subscription to remote participant tracks
  // IMPROVED: More robust with retry mechanism for late joins
  // ========================================
  useEffect(() => {
    if (participant.isLocal || isAudioOnlyMode(qualityMode)) return;
    
    // Get camera publications directly from participant
    const cameraPublications = Array.from(participant.trackPublications.values())
      .filter(pub => pub.source === Track.Source.Camera);
    
    if (cameraPublications.length === 0) {
      // No camera publication yet - this is normal for late joins
      // The TrackPublished event listener will trigger a re-render
      return;
    }
    
    // Force subscription for all camera tracks
    for (const publication of cameraPublications) {
      const remotePub = publication as RemoteTrackPublication | undefined;
      if (remotePub && !remotePub.isSubscribed) {
        logger.debug(`[ParticipantTile] Force subscribing to ${participant.identity} (trackSid: ${remotePub.trackSid})`);
        remotePub.setSubscribed(true);
      }
    }
  }, [participant, participant.trackPublications.size, participant.isLocal, qualityMode]);

  // ========================================
  // Listen for track events to force re-render
  // ========================================
  useEffect(() => {
    if (participant.isLocal || isAudioOnlyMode(qualityMode)) return;

    const handleTrackEvent = () => {
      logger.debug(`[ParticipantTile] Track event for ${participant.identity}, forcing re-render`);
      forceRender(v => v + 1);
    };
    
    participant.on(ParticipantEvent.TrackSubscribed, handleTrackEvent);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleTrackEvent);
    
    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleTrackEvent);
      participant.off(ParticipantEvent.TrackUnsubscribed, handleTrackEvent);
    };
  }, [participant, participant.isLocal, qualityMode]);

  // ========================================
  // Listen for new tracks being published (late joins)
  // ========================================
  useEffect(() => {
    if (participant.isLocal || isAudioOnlyMode(qualityMode)) return;
    
    const handleTrackPublished = (publication: RemoteTrackPublication) => {
      if (publication.source === Track.Source.Camera) {
        logger.debug(`[ParticipantTile] Camera published by ${participant.identity}, forcing subscription`);
        if (!publication.isSubscribed) {
          publication.setSubscribed(true);
        }
        forceRender(v => v + 1);
      }
    };
    
    participant.on(ParticipantEvent.TrackPublished, handleTrackPublished);
    
    return () => {
      participant.off(ParticipantEvent.TrackPublished, handleTrackPublished);
    };
  }, [participant, participant.isLocal, qualityMode]);

  // ========================================
  // Listen for participant metadata changes (permission updates)
  // ========================================
  useEffect(() => {
    if (participant.isLocal || isAudioOnlyMode(qualityMode)) return;

    const handleParticipantMetadataChanged = () => {
      logger.debug(`[ParticipantTile] Metadata changed for ${participant.identity}`);
      forceRender(v => v + 1);
    };
    
    participant.on(ParticipantEvent.ParticipantMetadataChanged, handleParticipantMetadataChanged);
    
    return () => {
      participant.off(ParticipantEvent.ParticipantMetadataChanged, handleParticipantMetadataChanged);
    };
  }, [participant, participant.isLocal, qualityMode]);

  // Debug logging for track state (development only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (participant.isLocal) return;
    
    const logTrackState = () => {
      const pub = cameraTrackRef?.publication;
      if (pub) {
        logger.debug(`[ParticipantTile] Track state for ${participant.identity}:`, {
          trackSid: pub.trackSid,
          isSubscribed: pub.isSubscribed,
          hasTrack: !!pub.track,
          isMuted: pub.isMuted,
          isEnabled: pub.isEnabled,
        });
      }
    };
    
    // Log initial state
    logTrackState();
    
    // Log when track changes
    const handleChange = () => {
      logger.debug(`[ParticipantTile] Track changed for ${participant.identity}`);
      logTrackState();
    };
    
    participant.on(ParticipantEvent.TrackSubscribed, handleChange);
    participant.on(ParticipantEvent.TrackUnsubscribed, handleChange);
    
    return () => {
      participant.off(ParticipantEvent.TrackSubscribed, handleChange);
      participant.off(ParticipantEvent.TrackUnsubscribed, handleChange);
    };
  }, [cameraTrackRef?.publication, participant, participant.isLocal]);

  // Derive subscription state directly from publication
  const isTrackSubscribed = (cameraTrackRef?.publication as RemoteTrackPublication | undefined)?.isSubscribed ?? false;

  // Phase 2: Check if video should be rendered based on visibility
  const shouldRenderVideoFromContext = visibilityContext.shouldRenderVideo(participant.identity);
  const isCullingActive = visibilityContext.isCullingActive;
  
  // Register this tile for visibility tracking (Phase 2)
  useEffect(() => {
    if (isCullingActive && tileRef.current) {
      visibilityContext.registerParticipant(participant.identity, tileRef.current);
      return () => {
        visibilityContext.unregisterParticipant(participant.identity);
      };
    }
  }, [participant.identity, visibilityContext, isCullingActive]);

  // hasVideo now uses the isTrackSubscribed state (reactive)
  const effectiveQualityMode = qualityMode || (qualityOverrideReason ? 'dataSaver' : selectedQualityMode);
  const audioOnlyMode = isAudioOnlyMode(effectiveQualityMode);

  const hasVideo = !audioOnlyMode && participant.isCameraEnabled && 
                   isTrackSubscribed && 
                   cameraTrackRef?.publication?.track;
                   
  // Phase 2: Only apply visibility culling when it's actually active
  const shouldShowVideo = Boolean(hasVideo) && 
                          (!isCullingActive || shouldRenderVideoFromContext) &&
                          (!isVideoPaused || meetingRoomConfig.performance.freezeLastFrameWhenPaused);
  const isMicMuted = !participant.isMicrophoneEnabled;

  // Get initials from name or identity
  // - Single name (Kris) → K
  // - Two names (Kris Prat) → KP
  // - Three+ names (Kris Prat Jose) → KJ (first & last)
  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) {
      return parts[0].charAt(0).toUpperCase();
    }
    if (parts.length === 2) {
      return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    }
    // 3+ names: first & last initial
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };
  
  // For local participant, use displayName from store as fallback before LiveKit connects
  const participantName = participant.isLocal 
    ? (participant.name || localDisplayName || participant.identity || '')
    : (participant.name || participant.identity || '');
  const initial = getInitials(participantName);

  const isFilmstrip = layout === 'speaker' && !isSpeakerTile;
  const avatarSize = isFilmstrip
    ? (isMobile ? 'w-[40%] aspect-square' : 'w-[84px] h-[84px]')
    : (isMobile ? 'w-[30%] aspect-square' : 'w-[120px] h-[120px]');
  const avatarTextSize = isFilmstrip
    ? (isMobile ? 'text-base' : 'text-[32px]')
    : (isMobile ? 'text-xl' : 'text-[45px]');

  const toggleFullscreen = async () => {
    if (!tileRef.current) return;

    try {
      if (document.fullscreenElement === tileRef.current) {
        // Already in fullscreen - exit
        await document.exitFullscreen();
      } else {
        // Not in fullscreen - enter
        await tileRef.current.requestFullscreen();
      }
    } catch (error) {
      logger.error('Failed to toggle fullscreen:', error);
      toast.error('Failed to toggle fullscreen');
    }
  };

  const gridParticipantCount = participantCount ?? 1;

  useEffect(() => {
    if (!cameraTrackRef?.publication || participant.isLocal || audioOnlyMode) {
      return;
    }

    const publication = cameraTrackRef.publication as RemoteTrackPublication | undefined;
    const element = tileRef.current;
    if (!element || !publication) {
      return;
    }

    const applyQuality = () => {
      const width = element.clientWidth;

      const targetLayer = resolveTileTargetLayer({
        width,
        isFullscreen,
        isPinned,
        isHostPresenter: layout === 'screenshare' && participant.identity === hostId,
        qualityMode: effectiveQualityMode,
        gridParticipantCount,
        screenWidth: window.innerWidth,
      });

      publication.setVideoQuality(resolveVideoQuality(targetLayer));
    };

    // Initial quality application
    applyQuality();

    // Debounced resize observer to prevent rapid quality changes
    let resizeTimeout: number | null = null;
    const resizeObserver = new ResizeObserver(() => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(applyQuality, 100);
    });
    resizeObserver.observe(element);

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === element);
      applyQuality();
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [cameraTrackRef, hostId, isFullscreen, isPinned, layout, participant.identity, participant.isLocal, effectiveQualityMode, gridParticipantCount, audioOnlyMode]);

  useEffect(() => {
    const publication = cameraTrackRef?.publication as RemoteTrackPublication | undefined;
    if (!publication || participant.isLocal) {
      setIsVideoPaused(false);
      return;
    }

    const syncPausedState = () => {
      const streamState = publication.track?.streamState;
      setIsVideoPaused(streamState === Track.StreamState.Paused);
    };

    const handleStreamStateChanged = (changedPublication: RemoteTrackPublication, streamState: Track.StreamState) => {
      if (changedPublication.trackSid !== publication.trackSid) {
        return;
      }
      setIsVideoPaused(streamState === Track.StreamState.Paused);
    };

    syncPausedState();
    participant.on(ParticipantEvent.TrackStreamStateChanged, handleStreamStateChanged);
    return () => {
      participant.off(ParticipantEvent.TrackStreamStateChanged, handleStreamStateChanged);
    };
  }, [cameraTrackRef, participant, participant.isLocal]);

  return (
    <div
      ref={tileRef}
      className={`relative bg-surface-800 group outline-[3px] ${isSpeaking ? 'outline-brand-400' : 'outline-transparent'} ${className}`}
    >
      {/* Video or avatar */}
      <div className="absolute inset-0 overflow-hidden">
        {shouldShowVideo && cameraTrackRef ? (
          <div 
            className={`absolute inset-0 overflow-hidden bg-black video-fit-${videoFitMode}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <VideoTrack 
              key={trackSid || 'no-track'}
              trackRef={cameraTrackRef as any}
              className={`w-full h-full ${participant.isLocal && mirrorLocalVideo ? 'scale-x-[-1]' : ''}`}
              style={{ 
                objectFit: videoFitMode,
                objectPosition: 'center',
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-700 to-surface-800">
            <div className={`${avatarSize} rounded-full flex items-center justify-center ${avatarTextSize} font-bold text-white transition-colors ${
              isSpeaking ? 'bg-brand-500' : 'bg-surface-600'
            }`}>
              {initial}
            </div>
          </div>
        )}
      </div>

      <div className={`absolute ${isMobile ? 'bottom-1 left-1 right-1' : 'bottom-2 left-2 right-2'} flex items-center gap-1 sm:gap-2`}>
        <div className="bg-black/60 backdrop-blur-sm px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-1 sm:gap-1.5">
          {isMicMuted ? (
            <MicOff size={isMobile ? 10 : 14} className="text-danger-400 shrink-0" />
          ) : (
            <Mic size={isMobile ? 10 : 14} className={`${isSpeaking ? 'text-brand-400 animate-mic-voice' : 'text-surface-300'} shrink-0`} />
          )}
          <span className={`${isMobile ? 'text-[9px]' : 'text-xs'} text-white truncate`}>
            {participant.isLocal && !participant.name && localDisplayName 
              ? localDisplayName 
              : <ParticipantName participant={participant} />}
          </span>
        </div>
        {isSpeakerTile && (
          <span className="text-[10px] text-surface-400 items-center gap-0.5 shrink-0 hidden sm:flex" title={`Video fit: ${videoFitMode}`}>
          {videoFitMode === 'contain' ? <Square size={10} /> : <Crop size={10} />}
          </span>
        )}
        {meetingRoomConfig.features.connectionQualityIndicator && !isMobile && isSpeakerTile && (
          <SignalBars quality={connectionQuality} />
        )}
      </div>

      {hasRaisedHand && (
        <div className={`absolute top-1 sm:top-2 right-1 sm:right-2 bg-warning-500 text-surface-900 ${isMobile ? 'text-[8px]' : 'text-[10px]'} font-bold px-1.5 sm:px-2 py-0.5 sm:py-1 flex items-center gap-0.5 sm:gap-1 shadow`}>
          <Hand size={isMobile ? 8 : 10} /> 
          {(isSpeakerTile || !isMobile) && <span>Raised</span>}
        </div>
      )}

      {/* Pin button (hover) */}
      <button
        onClick={() => setPinned(isPinned ? null : participant.identity)}
        className={`absolute top-2 left-2 p-1.5 transition-all ${
          isPinned 
            ? 'opacity-100 bg-brand-500 text-white' 
            : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-black/50 hover:bg-black/70 text-white'
        }`}
        title={isPinned ? 'Unpin' : 'Pin'}
      >
        <Pin size={14} />
      </button>
      {meetingRoomConfig.features.fullscreenTileView && (
        <button
          onClick={() => { void toggleFullscreen(); }}
          className="absolute top-2 left-11 p-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 bg-black/50 hover:bg-black/70 text-white transition-all"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
      )}
    </div>
  );
}

/**
 * Custom comparison function for React.memo
 * 
 * NOTE: We use a simple identity-based comparison instead of deep property comparison.
 * This is because track subscription state is internal to LiveKit and changes
 * without changing the participant's public properties. Deep comparison was
 * causing videos to not appear when track subscriptions changed.
 */
function arePropsEqual(prevProps: ParticipantTileProps, nextProps: ParticipantTileProps): boolean {
  // Simple reference equality check
  // This means we only skip re-render if it's the EXACT same props
  return (
    prevProps.participant === nextProps.participant &&
    prevProps.className === nextProps.className &&
    prevProps.isSpeakerTile === nextProps.isSpeakerTile &&
    prevProps.participantCount === nextProps.participantCount
  );
}

// Export memoized component to prevent cascade re-renders
const MemoizedParticipantTile = memo(ParticipantTileInner, arePropsEqual);

// Named export for backwards compatibility - uses memoized version
export const ParticipantTile = MemoizedParticipantTile;
export const ParticipantTileMemo = MemoizedParticipantTile;

// Error boundary for individual participant tiles
interface TileErrorBoundaryProps {
  children: ReactNode;
  participantName?: string;
}

interface TileErrorBoundaryState {
  hasError: boolean;
}

class TileErrorBoundary extends Component<TileErrorBoundaryProps, TileErrorBoundaryState> {
  constructor(props: TileErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): TileErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (import.meta.env.DEV) {
      logger.error('[ParticipantTile] Error rendering tile:', error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center bg-surface-800 rounded-xl h-full min-h-[120px]">
          <div className="text-center text-surface-400 p-4">
            <p className="text-sm">Video unavailable</p>
            <p className="text-xs mt-1">{this.props.participantName || 'Participant'}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Safe wrapper that wraps memoized tile in error boundary
export const SafeParticipantTile = memo(function SafeParticipantTile(props: ParticipantTileProps) {
  return (
    <TileErrorBoundary participantName={props.participant.name}>
      <MemoizedParticipantTile {...props} />
    </TileErrorBoundary>
  );
}, arePropsEqual);
