/**
 * ParticipantVisibilityContext - Context for Phase 2 optimizations
 * 
 * Provides centralized visibility tracking, tab visibility optimization,
 * and video pooling across all participant tiles.
 */

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { useVisibleParticipants } from '../hooks/useVisibleParticipants';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { useVideoPool } from '../hooks/useVideoPool';
import { meetingRoomConfig } from '../config/meetingRoomConfig';

interface ParticipantVisibilityContextValue {
  // Visibility tracking
  visibleIdentities: Set<string>;
  cullableIdentities: Set<string>;
  registerParticipant: (identity: string, element: HTMLElement | null) => void;
  unregisterParticipant: (identity: string) => void;
  shouldRenderVideo: (identity: string) => boolean;
  visibleCount: number;
  culledCount: number;
  isCullingActive: boolean;
  
  // Tab visibility
  isTabVisible: boolean;
  shouldPauseVideoForTab: boolean;
  hiddenDuration: number;
  
  // Video pooling
  acquireVideo: (participantIdentity: string) => HTMLVideoElement | null;
  releaseVideo: (participantIdentity: string) => void;
  getPoolStats: () => { total: number; inUse: number; available: number };
}

const ParticipantVisibilityContext = createContext<ParticipantVisibilityContextValue | null>(null);

// Stable default sets
const EMPTY_SET = new Set<string>();

// Default context value - stable reference
const defaultContext: ParticipantVisibilityContextValue = {
  visibleIdentities: EMPTY_SET,
  cullableIdentities: EMPTY_SET,
  registerParticipant: () => {},
  unregisterParticipant: () => {},
  shouldRenderVideo: () => true,
  visibleCount: 0,
  culledCount: 0,
  isCullingActive: false,
  isTabVisible: true,
  shouldPauseVideoForTab: false,
  hiddenDuration: 0,
  acquireVideo: () => null,
  releaseVideo: () => {},
  getPoolStats: () => ({ total: 0, inUse: 0, available: 0 }),
};

export function useParticipantVisibility() {
  const context = useContext(ParticipantVisibilityContext);
  if (!context) {
    return defaultContext;
  }
  return context;
}

interface ParticipantVisibilityProviderProps {
  children: ReactNode;
  /** Enable participant culling */
  enableCulling?: boolean;
  /** Enable tab visibility optimization */
  enableTabOptimization?: boolean;
  /** Enable video pooling */
  enablePooling?: boolean;
}

export function ParticipantVisibilityProvider({
  children,
  enableCulling = true,
  enableTabOptimization = true,
  enablePooling = true,
}: ParticipantVisibilityProviderProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  // Filter to admitted participants only
  const admittedParticipants = useMemo(() => 
    participants.filter(p => {
      if (p.identity === localParticipant?.identity) return true;
      return p.permissions?.canPublish !== false;
    }),
    [participants, localParticipant]
  );

  // Phase 2.1: Visible participant culling
  const visibility = useVisibleParticipants(admittedParticipants, {
    enabled: enableCulling && meetingRoomConfig.performance.enableParticipantCulling,
    maxVisibleVideos: meetingRoomConfig.performance.maxVisibleParticipants,
    cullingDelay: meetingRoomConfig.performance.offscreenPauseDelayMs,
    cullingThreshold: meetingRoomConfig.performance.cullingThreshold,
  });

  // Phase 2.2: Tab visibility optimization
  const tabVisibility = useTabVisibility({
    enabled: enableTabOptimization && meetingRoomConfig.performance.pauseVideoOnTabHidden,
    hideDelay: meetingRoomConfig.performance.tabVisibilityHideDelayMs,
  });

  // Phase 2.3: Video element pooling
  const videoPool = useVideoPool({
    enabled: enablePooling && meetingRoomConfig.performance.enableVideoPooling,
    poolSize: meetingRoomConfig.performance.videoPoolSize,
    recycleDelay: meetingRoomConfig.performance.videoRecycleDelayMs,
  });

  // Pre-warm video pool when component mounts
  useEffect(() => {
    if (enablePooling && meetingRoomConfig.performance.enableVideoPooling) {
      videoPool.prewarm(Math.min(8, meetingRoomConfig.performance.videoPoolSize));
    }
  }, [enablePooling, videoPool]);

  // Memoize context value - only update when key values change
  const value = useMemo((): ParticipantVisibilityContextValue => ({
    // Visibility tracking - use safe defaults if undefined
    visibleIdentities: visibility.visibleIdentities ?? EMPTY_SET,
    cullableIdentities: visibility.cullableIdentities ?? EMPTY_SET,
    registerParticipant: visibility.registerParticipant ?? (() => {}),
    unregisterParticipant: visibility.unregisterParticipant ?? (() => {}),
    shouldRenderVideo: visibility.shouldRenderVideo ?? (() => true),
    visibleCount: visibility.visibleCount ?? 0,
    culledCount: visibility.culledCount ?? 0,
    isCullingActive: visibility.isCullingActive ?? false,
    
    // Tab visibility
    isTabVisible: tabVisibility.isVisible ?? true,
    shouldPauseVideoForTab: tabVisibility.shouldPauseVideo ?? false,
    hiddenDuration: tabVisibility.hiddenDuration ?? 0,
    
    // Video pooling
    acquireVideo: videoPool.acquireVideo ?? (() => null),
    releaseVideo: videoPool.releaseVideo ?? (() => {}),
    getPoolStats: videoPool.getPoolStats ?? (() => ({ total: 0, inUse: 0, available: 0 })),
  }), [
    visibility.visibleIdentities,
    visibility.cullableIdentities,
    visibility.registerParticipant,
    visibility.unregisterParticipant,
    visibility.shouldRenderVideo,
    visibility.visibleCount,
    visibility.culledCount,
    visibility.isCullingActive,
    tabVisibility.isVisible,
    tabVisibility.shouldPauseVideo,
    tabVisibility.hiddenDuration,
    videoPool.acquireVideo,
    videoPool.releaseVideo,
    videoPool.getPoolStats,
  ]);

  return (
    <ParticipantVisibilityContext.Provider value={value}>
      {children}
    </ParticipantVisibilityContext.Provider>
  );
}
