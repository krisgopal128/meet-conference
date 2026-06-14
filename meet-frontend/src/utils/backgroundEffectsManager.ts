/**
 * backgroundEffectsManager — background-effect lifecycle (enable/disable/
 * toggle/update) for the room's transmitted video track, using MediaPipe
 * Selfie Segmentation with the full GPU compositing pipeline.
 *
 * The processor is wrapped in @livekit/track-processors' ProcessorWrapper,
 * which adapts our VideoTransformer to LiveKit's TrackProcessor interface.
 *
 * Module-level singleton — acceptable here because:
 * 1. Only one camera track per participant (no multi-camera support)
 * 2. Track processor lifecycle is tied to the room session
 * 3. Manager state is cleared via cleanupBackgroundEffect() on leave
 *
 * If multi-camera support is added, refactor to a class instance
 * per track (passed via React context or factory function).
 */

import { ProcessorWrapper } from '@livekit/track-processors';
import {
  SelfieSegmentationTransformer,
  type SelfieSegmentationOptions,
} from './selfieSegmentationTransformer';
import type { BackgroundMode } from './backgroundBlurEngine';
import logger from './logger';

interface VideoTrack {
  setProcessor: (processor: unknown) => Promise<void>;
  stopProcessor: () => Promise<void>;
}

interface ManagerState {
  processor: ProcessorWrapper<SelfieSegmentationOptions, SelfieSegmentationTransformer> | null;
  transformer: SelfieSegmentationTransformer | null;
  currentTrack: VideoTrack | null;
  isEnabled: boolean;
  isApplying: boolean;
  lockPromise: Promise<void> | null;
  lastToggleTime: number;
}

const state: ManagerState = {
  processor: null,
  transformer: null,
  currentTrack: null,
  isEnabled: false,
  isApplying: false,
  lockPromise: null,
  lastToggleTime: 0,
};

// Debounce for continuous updates (slider changes, etc.), NOT for toggle
const UPDATE_DEBOUNCE_MS = 300;
// Lock timeout for preventing concurrent operations
const LOCK_TIMEOUT_MS = 3000;
// Timeout for individual async operations like setProcessor
const OPERATION_TIMEOUT_MS = 5000;

async function acquireLock(): Promise<() => void> {
  while (state.lockPromise) {
    try {
      await state.lockPromise;
    } catch {
      // Ignore errors from previous operation
    }
  }

  let releaseLock = () => {};
  let safetyTimeout: ReturnType<typeof setTimeout> | null = null;
  state.lockPromise = new Promise<void>((resolve) => {
    releaseLock = () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
      resolve();
    };
    safetyTimeout = setTimeout(() => {
      if (state.lockPromise) {
        logger.warn('[BgEffects] Lock timeout (3s), forcing release');
        state.isApplying = false;
        safetyTimeout = null;
        resolve();
      }
    }, LOCK_TIMEOUT_MS);
  });

  return releaseLock;
}

// Debounce for continuous updates (slider, color picker), NOT toggle
function canContinueUpdating(): boolean {
  const now = Date.now();
  if (now - state.lastToggleTime < UPDATE_DEBOUNCE_MS) {
    return false;
  }
  return true;
}

// Wrap promise with timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timeout after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Enable background effect on a video track.
 * NOTE: Debounce is NOT applied to toggle actions - only to continuous updates
 */
export async function enableBackgroundEffect(
  track: VideoTrack,
  options?: Partial<SelfieSegmentationOptions>,
): Promise<boolean> {
  if (state.isApplying) {
    logger.warn('[BgEffects] Already applying effect, ignoring call');
    return false;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    logger.info('[BgEffects] Enabling background effect...');

    // If processor exists on same track, just update options
    if (state.transformer && state.currentTrack === track) {
      logger.info('[BgEffects] Reusing existing transformer');
      await withTimeout(
        state.transformer.update({
          enabled: true,
          ...options,
        }),
        OPERATION_TIMEOUT_MS
      );
      state.isEnabled = true;
      return true;
    }

    // Clean up old processor
    if (state.processor && state.currentTrack) {
      try {
        await withTimeout(state.currentTrack.stopProcessor(), OPERATION_TIMEOUT_MS);
      } catch (err) {
        logger.warn('[BgEffects] Error stopping old processor:', err);
      }
      state.processor = null;
      state.transformer = null;
    }

    // Create new transformer and wrap in ProcessorWrapper
    const transformer = new SelfieSegmentationTransformer({
      enabled: true,
      mode: 'blur',
      blurRadius: 14,
      feather: 3,
      bgColor: '#1e1e2e',
      bgImagePath: null,
      ...options,
    });
    const processor = new ProcessorWrapper(transformer, 'selfie-segmentation');

    await withTimeout(track.setProcessor(processor), OPERATION_TIMEOUT_MS);

    state.transformer = transformer;
    state.processor = processor;
    state.currentTrack = track;
    state.isEnabled = true;

    logger.info('[BgEffects] Background effect enabled');
    return true;
  } catch (err) {
    logger.error('[BgEffects] Failed to enable:', err);
    state.isEnabled = false;
    return false;
  } finally {
    state.isApplying = false;
    releaseLock();
  }
}

/**
 * Disable background effect (switch to passthrough).
 * NOTE: Debounce is NOT applied to toggle actions - only to continuous updates
 */
export async function disableBackgroundEffect(_track: VideoTrack): Promise<boolean> {
  if (state.isApplying) {
    logger.warn('[BgEffects] Already applying effect, ignoring call');
    return false;
  }
  if (!state.transformer) {
    state.isEnabled = false;
    return true;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    await withTimeout(state.transformer.update({ enabled: false }), OPERATION_TIMEOUT_MS);
    state.isEnabled = false;
    logger.info('[BgEffects] Background effect disabled');
    return true;
  } catch (err) {
    logger.error('[BgEffects] Failed to disable:', err);
    state.isEnabled = false;
    return false;
  } finally {
    state.isApplying = false;
    releaseLock();
  }
}

/**
 * Update background effect settings at runtime (mode, blur radius, etc).
 * This DOES apply debounce to prevent excessive updates from sliders/pickers
 */
export async function updateBackgroundEffect(
  options: Partial<SelfieSegmentationOptions>,
): Promise<void> {
  if (!state.transformer) return;
  
  // Apply debounce for continuous updates (slider changes)
  if (!canContinueUpdating()) {
    logger.debug('[BgEffects] Skipping update due to debounce');
    return;
  }
  
  state.lastToggleTime = Date.now();

  try {
    await withTimeout(state.transformer.update(options), OPERATION_TIMEOUT_MS);
  } catch (err) {
    logger.warn('[BgEffects] Failed to update options:', err);
  }
}

/**
 * Toggle background effect on/off.
 */
export function toggleBackgroundEffect(
  track: VideoTrack,
  enabled: boolean,
  options?: Partial<SelfieSegmentationOptions>,
): Promise<boolean> {
  if (enabled) {
    return enableBackgroundEffect(track, options);
  }
  return disableBackgroundEffect(track);
}

/**
 * Set the background mode (blur, image, color, none).
 */
export async function setBackgroundMode(
  mode: BackgroundMode,
  extraOptions?: { blurRadius?: number; bgColor?: string; bgImagePath?: string },
): Promise<void> {
  await updateBackgroundEffect({
    mode,
    enabled: mode !== 'none',
    ...extraOptions,
  });
}

export function isBackgroundEffectEnabled(): boolean {
  return state.isEnabled;
}

export function isBackgroundEffectApplying(): boolean {
  return state.isApplying;
}

/**
 * Force cleanup (unmount or track change).
 */
export async function cleanupBackgroundEffect(track?: VideoTrack): Promise<void> {
  const targetTrack = track || state.currentTrack;
  if (targetTrack) {
    try {
      await targetTrack.stopProcessor();
    } catch {
      // Ignore
    }
  }
  state.processor = null;
  state.transformer = null;
  state.currentTrack = null;
  state.isEnabled = false;
  state.isApplying = false;
}

// ─── Performance helpers ─────────

const AUTO_DISABLE_THRESHOLD = 9;

export function shouldAutoDisableBackgroundEffect(participantCount: number): boolean {
  return participantCount >= AUTO_DISABLE_THRESHOLD;
}

export function getAdaptiveBlurRadius(participantCount: number): number {
  if (participantCount <= 4) return 14;
  if (participantCount <= 8) return 10;
  return 7;
}
