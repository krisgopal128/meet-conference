/**
 * useTabVisibility - Tab visibility optimization for video calls
 * 
 * Detects when the browser tab is hidden/visible and provides callbacks
 * to pause/resume video tracks when the user switches away.
 * 
 * Phase 2 Feature: Tab Visibility Optimization
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseTabVisibilityOptions {
  /** Whether to enable tab visibility optimization */
  enabled?: boolean;
  /** Callback when tab becomes hidden */
  onHidden?: () => void;
  /** Callback when tab becomes visible */
  onVisible?: () => void;
  /** Delay before considering tab truly hidden (to avoid flicker during alt-tab) */
  hideDelay?: number;
}

interface UseTabVisibilityReturn {
  /** Whether the tab is currently visible */
  isVisible: boolean;
  /** Whether the tab is currently hidden */
  isHidden: boolean;
  /** Manual pause function */
  pause: () => void;
  /** Manual resume function */
  resume: () => void;
  /** Whether video should be paused */
  shouldPauseVideo: boolean;
  /** Time since tab was hidden (ms, 0 if visible) */
  hiddenDuration: number;
}

export function useTabVisibility(
  options: UseTabVisibilityOptions = {}
): UseTabVisibilityReturn {
  const {
    enabled = true,
    onHidden,
    onVisible,
    hideDelay = 500, // 500ms delay to avoid flicker
  } = options;

  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [shouldPauseVideo, setShouldPauseVideo] = useState(false);
  const [hiddenDuration, setHiddenDuration] = useState(0);
  
  const hideTimerRef = useRef<number | null>(null);
  const hiddenAtRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<number | null>(null);
  
  // Store callbacks in refs to prevent effect teardown on every render
  const onHiddenRef = useRef(onHidden);
  const onVisibleRef = useRef(onVisible);
  onHiddenRef.current = onHidden;
  onVisibleRef.current = onVisible;

  const pause = useCallback(() => {
    setShouldPauseVideo(true);
  }, []);

  const resume = useCallback(() => {
    setShouldPauseVideo(false);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsVisible(true);
      setShouldPauseVideo(false);
      setHiddenDuration(0);
      return;
    }

    const handleVisibilityChange = () => {
      const nowVisible = !document.hidden;

      if (nowVisible) {
        // Clear hide timer if tab becomes visible quickly
        if (hideTimerRef.current) {
          window.clearTimeout(hideTimerRef.current);
          hideTimerRef.current = null;
        }

        setIsVisible(true);
        setShouldPauseVideo(false);
        setHiddenDuration(0);
        hiddenAtRef.current = null;

        // Stop duration tracking
        if (durationIntervalRef.current) {
          window.clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        onVisibleRef.current?.();
      } else {
        // Tab hidden - start delayed pause
        hideTimerRef.current = window.setTimeout(() => {
          setIsVisible(false);
          setShouldPauseVideo(true);
          hiddenAtRef.current = Date.now();

          // Start tracking hidden duration
          durationIntervalRef.current = window.setInterval(() => {
            if (hiddenAtRef.current) {
              setHiddenDuration(Date.now() - hiddenAtRef.current);
            }
          }, 1000);

          onHiddenRef.current?.();
        }, hideDelay);
      }
    };

    // Initial state
    handleVisibilityChange();

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
      if (durationIntervalRef.current) {
        window.clearInterval(durationIntervalRef.current);
      }
    };
  }, [enabled, hideDelay]);

  return {
    isVisible,
    isHidden: !isVisible,
    pause,
    resume,
    shouldPauseVideo,
    hiddenDuration,
  };
}

// Removed unused useTabVisibilityEffect - use useTabVisibility instead
