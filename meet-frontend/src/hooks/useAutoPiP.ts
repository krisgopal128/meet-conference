/**
 * useAutoPiP - Auto-trigger Picture-in-Picture on tab switch
 *
 * Automatically opens PiP when user switches tabs during a meeting.
 * Includes cooldown to prevent spam and configurable triggers.
 */

import { useEffect, useRef, useCallback } from 'react';
import logger from '../utils/logger';

export type AutoPiPMode = 'always' | 'tab-switch' | 'never';

export interface AutoPiPOptions {
  /** Whether auto-PiP is enabled */
  enabled: boolean;
  /** Whether user is currently in a meeting */
  isInMeeting: boolean;
  /** Callback to trigger PiP */
  onTrigger: () => void;
  /** Cooldown between triggers in ms (default: 5000) */
  cooldown?: number;
  /** Whether to also trigger on window blur (default: false) */
  triggerOnBlur?: boolean;
}

export interface UseAutoPiPReturn {
  /** Reset the PiP opened state (call when PiP closes) */
  resetPipOpened: () => void;
  /** Whether auto-PiP is currently active */
  isActive: boolean;
}

/**
 * Hook to automatically trigger Picture-in-Picture when user switches tabs
 */
export function useAutoPiP({
  enabled,
  isInMeeting,
  onTrigger,
  cooldown = 5000,
  triggerOnBlur = false,
}: AutoPiPOptions): UseAutoPiPReturn {
  const lastTriggerRef = useRef(0);
  const pipOpenedRef = useRef(false);

  // Stable callback ref to avoid re-registering event listener
  const onTriggerRef = useRef(onTrigger);
  onTriggerRef.current = onTrigger;

  const handleTrigger = useCallback(() => {
    const now = Date.now();
    if (now - lastTriggerRef.current >= cooldown && !pipOpenedRef.current) {
      lastTriggerRef.current = now;
      pipOpenedRef.current = true;
      onTriggerRef.current();
      logger.info('[useAutoPiP] Triggered auto-PiP');
    }
  }, [cooldown]);

  useEffect(() => {
    if (!enabled || !isInMeeting) {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - trigger PiP
        handleTrigger();
      }
    };

    const handleBlur = () => {
      if (triggerOnBlur && !document.hasFocus()) {
        // Window lost focus - trigger PiP
        handleTrigger();
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (triggerOnBlur) {
      window.addEventListener('blur', handleBlur);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (triggerOnBlur) {
        window.removeEventListener('blur', handleBlur);
      }
    };
  }, [enabled, isInMeeting, triggerOnBlur, handleTrigger]);

  const resetPipOpened = useCallback(() => {
    pipOpenedRef.current = false;
  }, []);

  const isActive = enabled && isInMeeting;

  return {
    resetPipOpened,
    isActive,
  };
}

export default useAutoPiP;
