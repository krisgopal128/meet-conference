/**
 * useVideoPool - Video element pooling for better performance
 * 
 * Maintains a pool of video elements that can be reused across participants,
 * reducing the overhead of creating/destroying video elements during layout changes.
 * 
 * Phase 2 Feature: Video Element Pooling
 */

import { useRef, useCallback, useEffect, useMemo } from 'react';
import type { RemoteVideoTrack } from 'livekit-client';
import logger from '../utils/logger';

interface PooledVideo {
  id: string;
  element: HTMLVideoElement | null;
  inUse: boolean;
  assignedTo: string | null; // participant identity
  lastUsed: number;
}

interface UseVideoPoolOptions {
  /** Maximum number of video elements to pool */
  poolSize?: number;
  /** Whether to enable pooling */
  enabled?: boolean;
  /** Time before an unused video element is recycled (ms) */
  recycleDelay?: number;
}

interface UseVideoPoolReturn {
  /** Get or create a video element for a participant */
  acquireVideo: (participantIdentity: string) => HTMLVideoElement | null;
  /** Release a video element back to the pool */
  releaseVideo: (participantIdentity: string) => void;
  /** Get the current pool stats */
  getPoolStats: () => { total: number; inUse: number; available: number };
  /** Pre-warm the pool with video elements */
  prewarm: (count: number) => void;
  /** Clear all pooled elements */
  clear: () => void;
  /** Pause an off-screen participant's video track to save resources */
  pauseOffscreenTrack: (identity: string, track: RemoteVideoTrack) => void;
  /** Resume an on-screen participant's video track */
  resumeOnscreenTrack: (identity: string, track: RemoteVideoTrack) => void;
  /** Track element visibility and auto pause/resume the video track */
  trackVisibility: (element: HTMLElement, identity: string, track: RemoteVideoTrack | null) => () => void;
}

const DEFAULT_POOL_SIZE = 16;
const DEFAULT_RECYCLE_DELAY = 5000; // 5 seconds

export function useVideoPool(
  options: UseVideoPoolOptions = {}
): UseVideoPoolReturn {
  const {
    poolSize = DEFAULT_POOL_SIZE,
    enabled = true,
    recycleDelay = DEFAULT_RECYCLE_DELAY,
  } = options;

  const poolRef = useRef<Map<string, PooledVideo>>(new Map());
  const recycleTimersRef = useRef<Map<string, number>>(new Map());
  // O(1) lookup maps for participant-to-video and available tracking
  const participantToVideoRef = useRef<Map<string, string>>(new Map());
  const availableVideosRef = useRef<Set<string>>(new Set());
  const idCounterRef = useRef(0);

  // Identity-based MediaStream caching per participant
  const streamCacheRef = useRef<Map<string, MediaStream>>(new Map());
  // IntersectionObserver instances for visibility tracking
  const visibilityObserversRef = useRef<Map<string, IntersectionObserver>>(new Map());

  // Create a new video element
  const createVideoElement = useCallback((): HTMLVideoElement => {
    const video = document.createElement('video');
    video.setAttribute('playsinline', 'true');
    video.setAttribute('autoplay', 'true');
    video.setAttribute('muted', 'true');
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    return video;
  }, []);

  // Get or create a video element for a participant
  const acquireVideo = useCallback((participantIdentity: string): HTMLVideoElement | null => {
    if (!enabled) {
      return createVideoElement();
    }

    // O(1) check if this participant already has an assigned video
    const existingVideoId = participantToVideoRef.current.get(participantIdentity);
    if (existingVideoId) {
      const pooled = poolRef.current.get(existingVideoId);
      if (pooled) {
        // Clear any pending recycle timer
        const timer = recycleTimersRef.current.get(existingVideoId);
        if (timer) {
          window.clearTimeout(timer);
          recycleTimersRef.current.delete(existingVideoId);
        }
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        availableVideosRef.current.delete(existingVideoId);
        return pooled.element;
      }
    }

    // O(1) try to find an available video
    const availableId = availableVideosRef.current.values().next().value;
    if (availableId) {
      const pooled = poolRef.current.get(availableId);
      if (pooled) {
        const timer = recycleTimersRef.current.get(availableId);
        if (timer) {
          window.clearTimeout(timer);
          recycleTimersRef.current.delete(availableId);
        }
        pooled.inUse = true;
        pooled.assignedTo = participantIdentity;
        pooled.lastUsed = Date.now();
        availableVideosRef.current.delete(availableId);
        participantToVideoRef.current.set(participantIdentity, availableId);
        return pooled.element;
      }
    }

    // Pool is full or empty - create new if under limit
    if (poolRef.current.size < poolSize) {
      const id = `video-${++idCounterRef.current}`;
      const element = createVideoElement();
      const pooled: PooledVideo = {
        id,
        element,
        inUse: true,
        assignedTo: participantIdentity,
        lastUsed: Date.now(),
      };
      poolRef.current.set(id, pooled);
      participantToVideoRef.current.set(participantIdentity, id);
      return element;
    }

    // Pool is full - evict least-recently-used element from the entire pool
    let oldest: { id: string; lastUsed: number } | null = null;
    for (const [id, pooled] of poolRef.current) {
      if (!oldest || pooled.lastUsed < oldest.lastUsed) {
        oldest = { id, lastUsed: pooled.lastUsed };
      }
    }

    if (oldest) {
      const pooled = poolRef.current.get(oldest.id);
      if (pooled) {
        // Clean up the previous assignment so the old participant's release is a no-op
        if (pooled.assignedTo) {
          participantToVideoRef.current.delete(pooled.assignedTo);
        }
        // Clear any pending recycle timer
        const timer = recycleTimersRef.current.get(oldest.id);
        if (timer) {
          window.clearTimeout(timer);
          recycleTimersRef.current.delete(oldest.id);
        }
        pooled.assignedTo = participantIdentity;
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        availableVideosRef.current.delete(oldest.id);
        participantToVideoRef.current.set(participantIdentity, oldest.id);
        return pooled.element;
      }
    }

    // Fallback - create temporary element (not pooled)
    logger.warn('[useVideoPool] Pool exhausted, creating temporary video element');
    return createVideoElement();
  }, [enabled, poolSize, createVideoElement]);

  /**
   * Release a cached MediaStream for a participant identity.
   * Stops all tracks in the cached stream and removes it from the cache.
   */
  const releaseStream = useCallback((identity: string) => {
    const stream = streamCacheRef.current.get(identity);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      streamCacheRef.current.delete(identity);
      logger.debug(`[useVideoPool] Released cached stream for ${identity}`);
    }
  }, []);

  // Release a video element back to the pool
  const releaseVideo = useCallback((participantIdentity: string) => {
    if (!enabled) {
      return;
    }

    const videoId = participantToVideoRef.current.get(participantIdentity);
    if (!videoId) return;

    participantToVideoRef.current.delete(participantIdentity);
    const pooled = poolRef.current.get(videoId);
    if (!pooled) return;

    pooled.inUse = false;
    pooled.lastUsed = Date.now();
    availableVideosRef.current.add(videoId);

    // Schedule recycling if not reused within delay
    const timer = window.setTimeout(() => {
      const current = poolRef.current.get(videoId);
      if (current && !current.inUse) {
        if (current.element) {
          current.element.srcObject = null;
          current.element.load();
        }
        current.assignedTo = null;
        availableVideosRef.current.delete(videoId);
      }
      recycleTimersRef.current.delete(videoId);
    }, recycleDelay);

    recycleTimersRef.current.set(videoId, timer);

    // Release cached MediaStream for this participant
    releaseStream(participantIdentity);
  }, [enabled, recycleDelay, releaseStream]);

  // Get pool stats
  const getPoolStats = useCallback(() => {
    let inUse = 0;
    poolRef.current.forEach(pooled => {
      if (pooled.inUse) inUse++;
    });
    return {
      total: poolRef.current.size,
      inUse,
      available: poolRef.current.size - inUse,
    };
  }, []);

  // Pre-warm the pool
  const prewarm = useCallback((count: number) => {
    if (!enabled) return;

    const toCreate = Math.min(count, poolSize - poolRef.current.size);
    for (let i = 0; i < toCreate; i++) {
      const id = `video-${++idCounterRef.current}`;
      const element = createVideoElement();
      const pooled: PooledVideo = {
        id,
        element,
        inUse: false,
        assignedTo: null,
        lastUsed: Date.now(),
      };
      poolRef.current.set(id, pooled);
      availableVideosRef.current.add(id);
    }
  }, [enabled, poolSize, createVideoElement]);

  // Clear the pool
  const clear = useCallback(() => {
    // Clear all recycle timers
    recycleTimersRef.current.forEach(timer => window.clearTimeout(timer));
    recycleTimersRef.current.clear();

    // Clear pool
    poolRef.current.forEach(pooled => {
      if (pooled.element) {
        pooled.element.srcObject = null;
        pooled.element.remove();
      }
    });
    poolRef.current.clear();
    participantToVideoRef.current.clear();
    availableVideosRef.current.clear();

    // Clear stream cache
    streamCacheRef.current.forEach(stream => {
      stream.getTracks().forEach(track => track.stop());
    });
    streamCacheRef.current.clear();

    // Clear visibility observers
    visibilityObserversRef.current.forEach(observer => observer.disconnect());
    visibilityObserversRef.current.clear();
  }, []);

  /**
   * Pause an off-screen participant's video track to save CPU/bandwidth.
   * Disables the underlying MediaStreamTrack to stop frame decoding.
   * Safe to call with null/undefined track (no-op).
   */
  const pauseOffscreenTrack = useCallback((identity: string, track: RemoteVideoTrack): void => {
    if (!track) return;
    try {
      track.mediaStreamTrack.enabled = false;
      logger.debug(`[useVideoPool] Paused offscreen track for ${identity}`);
    } catch (err) {
      logger.warn(`[useVideoPool] Failed to pause track for ${identity}:`, err);
    }
  }, []);

  /**
   * Resume an on-screen participant's video track.
   * Re-enables the underlying MediaStreamTrack to resume frame decoding.
   * Safe to call with null/undefined track (no-op).
   */
  const resumeOnscreenTrack = useCallback((identity: string, track: RemoteVideoTrack): void => {
    if (!track) return;
    try {
      track.mediaStreamTrack.enabled = true;
      logger.debug(`[useVideoPool] Resumed onscreen track for ${identity}`);
    } catch (err) {
      logger.warn(`[useVideoPool] Failed to resume track for ${identity}:`, err);
    }
  }, []);

  /**
   * Set up IntersectionObserver-based visibility tracking for a video element.
   * Automatically pauses the track when the element is off-screen and resumes when on-screen.
   * Returns a cleanup function to disconnect the observer.
   */
  const trackVisibility = useCallback((
    element: HTMLElement,
    identity: string,
    track: RemoteVideoTrack | null
  ): () => void => {
    // Clean up any existing observer for this identity
    const existingObserver = visibilityObserversRef.current.get(identity);
    if (existingObserver) {
      existingObserver.disconnect();
      visibilityObserversRef.current.delete(identity);
    }

    if (!track) {
      return () => {};
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!track) return;
        if (entry.isIntersecting) {
          resumeOnscreenTrack(identity, track);
        } else {
          pauseOffscreenTrack(identity, track);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    visibilityObserversRef.current.set(identity, observer);

    // Return cleanup function
    return () => {
      observer.disconnect();
      visibilityObserversRef.current.delete(identity);
    };
  }, [pauseOffscreenTrack, resumeOnscreenTrack]);

  // Cleanup on unmount - clear timers AND video elements to prevent memory leaks
  useEffect(() => {
    return () => {
      recycleTimersRef.current.forEach(timer => window.clearTimeout(timer));
      recycleTimersRef.current.clear();

      poolRef.current.forEach(pooled => {
        if (pooled.element) {
          pooled.element.srcObject = null;
          pooled.element.load();
          pooled.element.remove();
        }
      });
      poolRef.current.clear();
      participantToVideoRef.current.clear();
      availableVideosRef.current.clear();

      // Clean up stream cache
      streamCacheRef.current.forEach(stream => {
        stream.getTracks().forEach(track => track.stop());
      });
      streamCacheRef.current.clear();

      // Clean up visibility observers
      visibilityObserversRef.current.forEach(observer => observer.disconnect());
      visibilityObserversRef.current.clear();
    };
  }, []);

  return useMemo(() => ({
    acquireVideo,
    releaseVideo,
    getPoolStats,
    prewarm,
    clear,
    pauseOffscreenTrack,
    resumeOnscreenTrack,
    trackVisibility,
  }), [acquireVideo, releaseVideo, getPoolStats, prewarm, clear, pauseOffscreenTrack, resumeOnscreenTrack, trackVisibility]);
}
