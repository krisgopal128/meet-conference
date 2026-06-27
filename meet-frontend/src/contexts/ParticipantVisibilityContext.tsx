import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { useVisibleParticipants } from '../hooks/useVisibleParticipants';
import { useTabVisibility } from '../hooks/useTabVisibility';
import { meetingRoomConfig } from '../config/meetingRoomConfig';

interface ParticipantVisibilityContextValue {
  visibleIdentities: Set<string>;
  cullableIdentities: Set<string>;
  registerParticipant: (identity: string, element: HTMLElement | null) => void;
  unregisterParticipant: (identity: string) => void;
  shouldRenderVideo: (identity: string) => boolean;
  visibleCount: number;
  culledCount: number;
  isCullingActive: boolean;
  isTabVisible: boolean;
  shouldPauseVideoForTab: boolean;
  hiddenDuration: number;
}

const ParticipantVisibilityContext = createContext<ParticipantVisibilityContextValue | null>(null);

const EMPTY_SET = new Set<string>();

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
  enableCulling?: boolean;
  enableTabOptimization?: boolean;
}

export function ParticipantVisibilityProvider({
  children,
  enableCulling = true,
  enableTabOptimization = true,
}: ParticipantVisibilityProviderProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();

  const admittedParticipants = useMemo(() =>
    participants.filter(p => {
      if (p.identity === localParticipant?.identity) return true;
      return p.permissions?.canPublish !== false;
    }),
    [participants, localParticipant]
  );

  const visibility = useVisibleParticipants(admittedParticipants, {
    enabled: enableCulling && meetingRoomConfig.performance.enableParticipantCulling,
    maxVisibleVideos: meetingRoomConfig.performance.maxVisibleParticipants,
    cullingDelay: meetingRoomConfig.performance.offscreenPauseDelayMs,
    cullingThreshold: meetingRoomConfig.performance.cullingThreshold,
  });

  const tabVisibility = useTabVisibility({
    enabled: enableTabOptimization && meetingRoomConfig.performance.pauseVideoOnTabHidden,
    hideDelay: meetingRoomConfig.performance.tabVisibilityHideDelayMs,
  });

  const value = useMemo((): ParticipantVisibilityContextValue => ({
    visibleIdentities: visibility.visibleIdentities ?? EMPTY_SET,
    cullableIdentities: visibility.cullableIdentities ?? EMPTY_SET,
    registerParticipant: visibility.registerParticipant ?? (() => {}),
    unregisterParticipant: visibility.unregisterParticipant ?? (() => {}),
    shouldRenderVideo: visibility.shouldRenderVideo ?? (() => true),
    visibleCount: visibility.visibleCount ?? 0,
    culledCount: visibility.culledCount ?? 0,
    isCullingActive: visibility.isCullingActive ?? false,
    isTabVisible: tabVisibility.isVisible ?? true,
    shouldPauseVideoForTab: tabVisibility.shouldPauseVideo ?? false,
    hiddenDuration: tabVisibility.hiddenDuration ?? 0,
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
  ]);

  return (
    <ParticipantVisibilityContext.Provider value={value}>
      {children}
    </ParticipantVisibilityContext.Provider>
  );
}
