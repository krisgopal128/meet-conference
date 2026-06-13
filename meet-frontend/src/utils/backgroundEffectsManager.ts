/**
 * backgroundEffectsManager — Manages the SelfieSegmentationTransformer lifecycle
 * for the room's transmitted video track.
 *
 * Provides the same API shape as blurProcessorManager (enable/disable/toggle)
 * but uses MediaPipe Selfie Segmentation with the full GPU compositing pipeline
 * from the Camera_BG_Blur sample.
 *
 * The processor is wrapped in @livekit/track-processors' ProcessorWrapper,
 * which adapts our VideoTransformer to LiveKit's TrackProcessor interface.
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

const DEBOUNCE_MS = 300;
const LOCK_TIMEOUT_MS = 10000;

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
        logger.warn('[BgEffects] Lock timeout, forcing release');
        state.isApplying = false;
        safetyTimeout = null;
        resolve();
      }
    }, LOCK_TIMEOUT_MS);
  });

  return releaseLock;
}

function canToggle(): boolean {
  const now = Date.now();
  if (now - state.lastToggleTime < DEBOUNCE_MS) {
    return false;
  }
  return true;
}

/**
 * Enable background effect on a video track.
 */
export async function enableBackgroundEffect(
  track: VideoTrack,
  options?: Partial<SelfieSegmentationOptions>,
): Promise<boolean> {
  if (!canToggle()) return false;
  if (state.isApplying) return false;

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    logger.info('[BgEffects] Enabling background effect...');

    // If processor exists on same track, just update options
    if (state.transformer && state.currentTrack === track) {
      logger.info('[BgEffects] Reusing existing transformer');
      await state.transformer.update({
        enabled: true,
        ...options,
      });
      state.isEnabled = true;
      return true;
    }

    // Clean up old processor
    if (state.processor && state.currentTrack) {
      try {
        await state.currentTrack.stopProcessor();
      } catch {
        // Ignore
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

    await track.setProcessor(processor);

    state.transformer = transformer;
    state.processor = processor;
    state.currentTrack = track;
    state.isEnabled = true;

    logger.info('[BgEffects] Background effect enabled');
    return true;
  } catch (err) {
    logger.error('[BgEffects] Failed to enable:', err);
    return false;
  } finally {
    state.isApplying = false;
    releaseLock();
  }
}

/**
 * Disable background effect (switch to passthrough).
 */
export async function disableBackgroundEffect(_track: VideoTrack): Promise<boolean> {
  if (!canToggle()) return false;
  if (state.isApplying) return false;
  if (!state.transformer) {
    state.isEnabled = false;
    return true;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    await state.transformer.update({ enabled: false });
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
 */
export async function updateBackgroundEffect(
  options: Partial<SelfieSegmentationOptions>,
): Promise<void> {
  if (!state.transformer) return;
  try {
    await state.transformer.update(options);
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

// ─── Performance helpers (reused from blurProcessorManager) ─────────

const AUTO_DISABLE_THRESHOLD = 9;

export function shouldAutoDisableBackgroundEffect(participantCount: number): boolean {
  return participantCount >= AUTO_DISABLE_THRESHOLD;
}

export function getAdaptiveBlurRadius(participantCount: number): number {
  if (participantCount <= 4) return 14;
  if (participantCount <= 8) return 10;
  return 7;
}
