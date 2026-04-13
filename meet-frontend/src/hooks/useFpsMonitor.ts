/**
 * useFpsMonitor - FPS-based fallback monitoring
 * 
 * Used when LongTask API is not available for CPU monitoring.
 * Tracks frame rendering performance and triggers degradation when FPS drops.
 */

import { useEffect, useRef, useState } from 'react';

export function useFpsMonitor(options: {
  enabled?: boolean;
  lowFpsThreshold?: number;
  highFpsThreshold?: number;
  durationMs?: number;
  onLowFps?: () => void;
  onHighFps?: () => void;
} = {}): { fps: number | null; isLow: boolean } {
  const {
    enabled = true,
    lowFpsThreshold = 20,
    highFpsThreshold = 26,
    durationMs = 5000,
    onLowFps,
    onHighFps,
  } = options;

  const [fps, setFps] = useState<number | null>(null);
  const [isLow, setIsLow] = useState(false);
  const frameTimesRef = useRef<number[]>([]);
  const lowSinceRef = useRef<number | null>(null);
  const degradedRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  // Store callbacks in refs to prevent effect teardown
  const onLowFpsRef = useRef(onLowFps);
  const onHighFpsRef = useRef(onHighFps);
  useEffect(() => {
    onLowFpsRef.current = onLowFps;
    onHighFpsRef.current = onHighFps;
  }, [onLowFps, onHighFps]);

  useEffect(() => {
    if (!enabled) {
      setFps(null);
      setIsLow(false);
      return;
    }

    isMountedRef.current = true;

    const measureFrame = (timestamp: number) => {
      if (!isMountedRef.current) return;
      
      if (lastTimestampRef.current !== null) {
        const delta = timestamp - lastTimestampRef.current;
        frameTimesRef.current.push(delta);

        if (frameTimesRef.current.length > 10) {
          frameTimesRef.current.shift();
        }

        const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        const currentFps = Math.round(1000 / avgFrameTime);
        setFps(currentFps);

        if (currentFps < lowFpsThreshold) {
          if (!lowSinceRef.current) {
            lowSinceRef.current = timestamp;
          } else if (timestamp - lowSinceRef.current >= durationMs && !degradedRef.current) {
            degradedRef.current = true;
            setIsLow(true);
            onLowFpsRef.current?.();
          }
        } else {
          lowSinceRef.current = null;

          if (degradedRef.current && currentFps >= highFpsThreshold) {
            degradedRef.current = false;
            setIsLow(false);
            onHighFpsRef.current?.();
          }
        }
      }

      lastTimestampRef.current = timestamp;
      rafRef.current = requestAnimationFrame(measureFrame);
    };

    rafRef.current = requestAnimationFrame(measureFrame);

    return () => {
      isMountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, lowFpsThreshold, highFpsThreshold, durationMs]);

  return { fps, isLow };
}

export default useFpsMonitor;
