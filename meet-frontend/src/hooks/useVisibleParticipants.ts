/**
 * useVisibleParticipants - Centralized visibility tracking for participant culling
 * 
 * This hook tracks which participants are visible in the viewport and provides
 * a mechanism to pause video for offscreen participants, saving CPU and bandwidth.
 * 
 * Phase 2 Feature: Visible Participant Culling
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { Participant } from 'livekit-client';

interface UseVisibleParticipantsOptions {
  /** Maximum number of participants to render video for */
  maxVisibleVideos?: number;
  /** Delay before culling a participant that goes offscreen (ms) */
  cullingDelay?: number;
  /** Whether to enable participant culling */
  enabled?: boolean;
  /** Minimum number of participants before culling kicks in */
  cullingThreshold?: number;
}

interface UseVisibleParticipantsReturn {
  /** Set of participant identities that are currently visible */
  visibleIdentities: Set<string>;
  /** Set of participant identities that can be culled (offscreen) */
  cullableIdentities: Set<string>;
  /** Register a participant element for visibility tracking */
  registerParticipant: (identity: string, element: HTMLElement | null) => void;
  /** Unregister a participant element */
  unregisterParticipant: (identity: string) => void;
  /** Check if a participant should render video */
  shouldRenderVideo: (identity: string) => boolean;
  /** Total visible count */
  visibleCount: number;
  /** Total culled count */
  culledCount: number;
  /** Whether culling is active */
  isCullingActive: boolean;
}

const DEFAULT_MAX_VISIBLE = 12;
const DEFAULT_CULLING_DELAY = 1500; // 1.5 seconds
const DEFAULT_CULLING_THRESHOLD = 8; // Only cull when >8 participants

export function useVisibleParticipants(
  participants: Participant[],
  options: UseVisibleParticipantsOptions = {}
): UseVisibleParticipantsReturn {
  const {
    maxVisibleVideos = DEFAULT_MAX_VISIBLE,
    cullingDelay = DEFAULT_CULLING_DELAY,
    enabled = true,
    cullingThreshold = DEFAULT_CULLING_THRESHOLD,
  } = options;

  // Use refs instead of state to prevent re-render loops
  // Initialize directly with values (no lazy init needed)
  const elementRefs = useRef<Map<string, HTMLElement>>(new Map());
  const intersectionObservers = useRef<Map<string, IntersectionObserver>>(new Map());
  const cullingTimers = useRef<Map<string, number>>(new Map());
  const visibleInViewport = useRef<Map<string, boolean>>(new Map());
  const visibleIdentitiesRef = useRef<Set<string>>(new Set());
  const cullableIdentitiesRef = useRef<Set<string>>(new Set());
  const updateScheduledRef = useRef<number | null>(null);
  const participantsRef = useRef(participants);
  participantsRef.current = participants;

  const isCullingActive = useMemo(() => {
    return enabled && participants.length > cullingThreshold;
  }, [enabled, participants.length, cullingThreshold]);

  // Debounced visibility state update - prevents flickering
  const scheduleVisibilityUpdate = useCallback(() => {
    if (updateScheduledRef.current) {
      cancelAnimationFrame(updateScheduledRef.current);
    }
    updateScheduledRef.current = requestAnimationFrame(() => {
      updateScheduledRef.current = null;
      
      const allIdentities = new Set(participantsRef.current.map(p => p.identity));
      
      const visibleInViewportNow = new Set<string>();
      elementRefs.current.forEach((_element, identity) => {
        if (visibleInViewport.current.get(identity) && allIdentities.has(identity)) {
          visibleInViewportNow.add(identity);
        }
      });

      if (!isCullingActive) {
        visibleIdentitiesRef.current.clear();
        allIdentities.forEach(id => visibleIdentitiesRef.current.add(id));
        cullableIdentitiesRef.current.clear();
      } else {
        const limitedVisible = new Set(
          Array.from(visibleInViewportNow).slice(0, maxVisibleVideos)
        );
        visibleIdentitiesRef.current.clear();
        limitedVisible.forEach(id => visibleIdentitiesRef.current.add(id));
        cullableIdentitiesRef.current.clear();
        Array.from(allIdentities)
          .filter(id => !limitedVisible.has(id))
          .forEach(id => cullableIdentitiesRef.current.add(id));
      }
    });
  }, [isCullingActive, maxVisibleVideos]);

  const registerParticipant = useCallback((identity: string, element: HTMLElement | null) => {
    const existingObserver = intersectionObservers.current.get(identity);
    if (existingObserver) {
      existingObserver.disconnect();
      intersectionObservers.current.delete(identity);
    }

    const existingTimer = cullingTimers.current.get(identity);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
      cullingTimers.current.delete(identity);
    }

    if (!element) {
      elementRefs.current.delete(identity);
      visibleInViewport.current.delete(identity);
      scheduleVisibilityUpdate();
      return;
    }

    elementRefs.current.set(identity, element);
    visibleInViewport.current.set(identity, true);

    // Single threshold to reduce callback frequency
    const observer = new IntersectionObserver(
      ([entry]) => {
        const isVisible = entry.isIntersecting;
        const wasVisible = visibleInViewport.current.get(identity) ?? false;
        visibleInViewport.current.set(identity, isVisible);

        if (!isVisible && wasVisible) {
          // Delay culling to prevent flicker during scrolling
          const timer = window.setTimeout(() => {
            scheduleVisibilityUpdate();
          }, cullingDelay);
          cullingTimers.current.set(identity, timer);
        } else if (isVisible) {
          // Clear any pending cull timer
          const timer = cullingTimers.current.get(identity);
          if (timer) {
            window.clearTimeout(timer);
            cullingTimers.current.delete(identity);
          }
          // Update immediately when becoming visible
          scheduleVisibilityUpdate();
        }
      },
      { threshold: 0.1, rootMargin: '100px' } // Single threshold, larger margin
    );

    observer.observe(element);
    intersectionObservers.current.set(identity, observer);
    scheduleVisibilityUpdate();
  }, [cullingDelay, scheduleVisibilityUpdate]);

  const unregisterParticipant = useCallback((identity: string) => {
    const observer = intersectionObservers.current.get(identity);
    if (observer) {
      observer.disconnect();
      intersectionObservers.current.delete(identity);
    }

    const timer = cullingTimers.current.get(identity);
    if (timer) {
      window.clearTimeout(timer);
      cullingTimers.current.delete(identity);
    }

    elementRefs.current.delete(identity);
    visibleInViewport.current.delete(identity);
    scheduleVisibilityUpdate();
  }, [scheduleVisibilityUpdate]);

  // Stable shouldRenderVideo - uses ref, won't cause re-renders
  const shouldRenderVideo = useCallback((identity: string): boolean => {
    if (!isCullingActive) {
      return true;
    }
    return visibleIdentitiesRef.current.has(identity);
  }, [isCullingActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (updateScheduledRef.current) {
        cancelAnimationFrame(updateScheduledRef.current);
      }
      intersectionObservers.current.forEach(observer => observer.disconnect());
      intersectionObservers.current.clear();
      cullingTimers.current.forEach(timer => window.clearTimeout(timer));
      cullingTimers.current.clear();
    };
  }, []);

  return {
    visibleIdentities: visibleIdentitiesRef.current,
    cullableIdentities: cullableIdentitiesRef.current,
    registerParticipant,
    unregisterParticipant,
    shouldRenderVideo,
    visibleCount: visibleIdentitiesRef.current.size,
    culledCount: cullableIdentitiesRef.current.size,
    isCullingActive,
  };
}
