/**
 * useCpuMonitor - CPU-based quality degradation for Phase 3
 * 
 * Monitors main thread CPU usage using PerformanceObserver API.
 * When CPU is high for sustained periods, triggers quality degradation.
 * When CPU recovers, signals that quality can be restored.
 * 
 * Optimized: Increased polling interval to 5s, added FPS fallback
 * Phase 3 Feature: CPU-Based Degradation
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { meetingRoomConfig } from '../config/meetingRoomConfig';

export type CpuStatus = 'normal' | 'elevated' | 'critical' | 'unknown';

export interface CpuMonitorState {
  /** Current CPU usage percentage (0-100) */
  cpuPercent: number | null;
  /** Current status based on thresholds */
  status: CpuStatus;
  /** Whether CPU has been elevated for the threshold duration */
  shouldDegrade: boolean;
  /** Whether CPU has recovered after degradation */
  shouldRecover: boolean;
  /** Is monitoring active */
  isActive: boolean;
  /** FPS from fallback monitor (null if using LongTask API) */
  fps: number | null;
}

export interface CpuMonitorOptions {
  /** Enable/disable monitoring (overrides config) */
  enabled?: boolean;
  /** Check interval in ms (default: 5000ms - increased from 2000ms for stability) */
  checkIntervalMs?: number;
  /** CPU % threshold for elevated status (default from config) */
  highThreshold?: number;
  /** CPU % threshold for critical status (default from config) */
  criticalThreshold?: number;
  /** How long CPU must be elevated before triggering degradation */
  thresholdDurationMs?: number;
  /** CPU % below which recovery is triggered */
  recoveryThreshold?: number;
  /** Callback when degradation is recommended */
  onDegradation?: () => void;
  /** Callback when recovery is recommended */
  onRecovery?: () => void;
}

interface PerformanceEntryWithDuration extends PerformanceEntry {
  duration: number;
}

/**
 * Hook to monitor CPU usage and recommend quality adjustments
 * Uses LongTask API when available, falls back to FPS monitoring
 */
export function useCpuMonitor(options: CpuMonitorOptions = {}): CpuMonitorState {
  const {
    enabled = meetingRoomConfig.performance.cpuMonitorEnabled,
    checkIntervalMs = 5000,
    highThreshold = meetingRoomConfig.performance.cpuReductionThresholdPercent,
    criticalThreshold = 95,
    thresholdDurationMs = meetingRoomConfig.performance.cpuReductionThresholdDurationMs,
    recoveryThreshold = meetingRoomConfig.performance.recoveryThresholdPercent,
    onDegradation,
    onRecovery,
  } = options;

  // Store callbacks in refs to prevent effect teardown on every render
  const onDegradationRef = useRef(onDegradation);
  const onRecoveryRef = useRef(onRecovery);
  useEffect(() => {
    onDegradationRef.current = onDegradation;
    onRecoveryRef.current = onRecovery;
  }, [onDegradation, onRecovery]);

  const [state, setState] = useState<CpuMonitorState>({
    cpuPercent: null,
    status: 'unknown',
    shouldDegrade: false,
    shouldRecover: false,
    isActive: enabled,
    fps: null,
  });

  // Refs for tracking
  const cpuBusyWindowMsRef = useRef(0);
  const cpuBusyWindowStartedAtRef = useRef<number | null>(null);
  const elevatedSinceRef = useRef<number | null>(null);
  const degradedRef = useRef(false);
  const observerRef = useRef<PerformanceObserver | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longTaskSupportedRef = useRef<boolean | null>(null);
  
  // FPS fallback refs
  const frameTimesRef = useRef<number[]>([]);
  const lastTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Calculate status from CPU percent
  const calculateStatus = useCallback((cpuPercent: number | null): CpuStatus => {
    if (cpuPercent === null) return 'unknown';
    if (cpuPercent >= criticalThreshold) return 'critical';
    if (cpuPercent >= highThreshold) return 'elevated';
    return 'normal';
  }, [highThreshold, criticalThreshold]);

  // FPS-based CPU estimation fallback
  const estimateCpuFromFps = useCallback((): { cpuPercent: number; fps: number } | null => {
    if (frameTimesRef.current.length < 5) return null;
    
    const avgFrameTime = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
    const fps = Math.round(1000 / avgFrameTime);
    
    // Estimate CPU based on FPS deviation from 60fps target
    // Lower FPS = higher CPU load
    const targetFps = 60;
    const fpsRatio = Math.min(fps / targetFps, 1);
    // If FPS is 30, that's 50% of target, estimate ~70% CPU busy
    // If FPS is 60, that's 100% of target, estimate ~30% CPU busy (baseline)
    const cpuPercent = Math.round((1 - fpsRatio) * 80 + 20);
    
    return { cpuPercent: Math.min(100, cpuPercent), fps };
  }, []);

  // Main monitoring logic
  useEffect(() => {
    if (!enabled) {
      setState(prev => ({ ...prev, isActive: false, cpuPercent: null, status: 'unknown', fps: null }));
      return;
    }

    // Initialize timing
    cpuBusyWindowMsRef.current = 0;
    cpuBusyWindowStartedAtRef.current = performance.now();

    // Try to set up PerformanceObserver for long tasks
    try {
      observerRef.current = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const longTaskEntry = entry as PerformanceEntryWithDuration;
          cpuBusyWindowMsRef.current += longTaskEntry.duration;
        }
      });
      observerRef.current.observe({ type: 'longtask', buffered: true });
      longTaskSupportedRef.current = true;
      console.debug('[CpuMonitor] Using LongTask API for CPU monitoring');
    } catch {
      longTaskSupportedRef.current = false;
      console.debug('[CpuMonitor] LongTask API not available, using FPS fallback');
      
      // Start FPS monitoring as fallback
      const measureFrame = (timestamp: number) => {
        if (lastTimestampRef.current !== null) {
          const delta = timestamp - lastTimestampRef.current;
          frameTimesRef.current.push(delta);
          if (frameTimesRef.current.length > 30) {
            frameTimesRef.current.shift();
          }
        }
        lastTimestampRef.current = timestamp;
        rafRef.current = requestAnimationFrame(measureFrame);
      };
      rafRef.current = requestAnimationFrame(measureFrame);
    }

    // Check CPU usage periodically (now every 5s instead of 2s)
    intervalRef.current = setInterval(() => {
      let cpuPercent: number;
      let fps: number | null = null;

      if (longTaskSupportedRef.current) {
        // Use LongTask API
        const startedAt = cpuBusyWindowStartedAtRef.current ?? performance.now();
        const elapsedMs = Math.max(performance.now() - startedAt, 1);
        cpuPercent = Math.min(100, (cpuBusyWindowMsRef.current / elapsedMs) * 100);
        
        // Reset window for next interval
        cpuBusyWindowMsRef.current = 0;
        cpuBusyWindowStartedAtRef.current = performance.now();
      } else {
        // Use FPS fallback
        const estimate = estimateCpuFromFps();
        if (!estimate) return;
        cpuPercent = estimate.cpuPercent;
        fps = estimate.fps;
      }

      const status = calculateStatus(cpuPercent);

      // Track elevated state
      const isElevated = cpuPercent >= highThreshold;
      const now = Date.now();

      if (isElevated) {
        if (!elevatedSinceRef.current) {
          elevatedSinceRef.current = now;
        }
        
        const elevatedDuration = now - elevatedSinceRef.current;
        
        if (elevatedDuration >= thresholdDurationMs && !degradedRef.current) {
          degradedRef.current = true;
          setState({
            cpuPercent,
            status,
            shouldDegrade: true,
            shouldRecover: false,
            isActive: true,
            fps,
          });
            onDegradationRef.current?.();
          } else {
            setState(prev => ({
              ...prev,
              cpuPercent,
              status,
              shouldDegrade: false,
              fps,
            }));
          }
        } else {
          elevatedSinceRef.current = null;

          if (degradedRef.current && cpuPercent <= recoveryThreshold) {
            degradedRef.current = false;
            setState({
              cpuPercent,
              status,
              shouldDegrade: false,
              shouldRecover: true,
              isActive: true,
              fps,
            });
            onRecoveryRef.current?.();
        } else {
          setState(prev => ({
            ...prev,
            cpuPercent,
            status,
            shouldRecover: false,
            fps,
          }));
        }
      }
    }, checkIntervalMs);

    setState(prev => ({ ...prev, isActive: true }));

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [enabled, checkIntervalMs, highThreshold, criticalThreshold, thresholdDurationMs, recoveryThreshold, calculateStatus, estimateCpuFromFps]);

  return state;
}

// Re-export useFpsMonitor from its own file for backward compatibility
export { useFpsMonitor } from './useFpsMonitor';

export default useCpuMonitor;
