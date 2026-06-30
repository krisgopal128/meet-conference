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

// ─── Pre-init worker for conference blur ──────────────────────
// Started during PreJoin so WASM+model are loaded before RoomPage needs them.
// The SelfieSegmentationTransformer reuses this worker instead of creating a new one.
let preInitWorker: Worker | null = null;
let preInitWorkerReady = false;
let preInitReadyResolvers: Array<() => void> = [];

export function preInitBlurWorker(): void {
  if (preInitWorker) return;
  try {
    preInitWorker = new Worker(
      new URL('./segmentationWorker.ts', import.meta.url),
      { type: 'module' },
    );
    preInitWorker.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'ready') {
        preInitWorkerReady = true;
        logger.info('[BgEffects] Pre-init worker ready for conference blur');
        for (const resolve of preInitReadyResolvers) resolve();
        preInitReadyResolvers = [];
      }
    };
    preInitWorker.onerror = () => {
      logger.warn('[BgEffects] Pre-init worker failed — will create on demand');
      preInitWorker = null;
      for (const resolve of preInitReadyResolvers) resolve();
      preInitReadyResolvers = [];
    };
    preInitWorker.postMessage({ type: 'init' });
    logger.info('[BgEffects] Pre-initializing conference blur worker...');
  } catch (e) {
    logger.warn('[BgEffects] Failed to pre-init worker:', e);
    preInitWorker = null;
  }
}

/**
 * Returns a promise that resolves when the pre-init worker is ready (WASM +
 * model loaded), or immediately if pre-init was never called or already failed.
 * Used by RoomPage to gate camera publishing until blur is ready.
 */
export function waitForBlurWorkerReady(): Promise<void> {
  if (preInitWorkerReady || !preInitWorker) return Promise.resolve();
  return new Promise((resolve) => {
    preInitReadyResolvers.push(resolve);
  });
}

function consumePreInitWorker(): Worker | null {
  if (preInitWorker && preInitWorkerReady) {
    const w = preInitWorker;
    preInitWorker = null;
    preInitWorkerReady = false;
    return w;
  }
  return null;
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
      state.lockPromise = null;
      resolve();
    };
    safetyTimeout = setTimeout(() => {
      if (state.lockPromise) {
        logger.warn('[BgEffects] Lock timeout (3s), forcing release');
        state.isApplying = false;
        state.lockPromise = null;
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

    // Clean up old processor — destroy transformer BEFORE nulling to avoid leak
    if (state.processor && state.currentTrack) {
      try {
        await withTimeout(state.currentTrack.stopProcessor(), OPERATION_TIMEOUT_MS);
      } catch (err) {
        logger.warn('[BgEffects] Error stopping old processor:', err);
      }
      if (state.transformer) {
        try {
          await withTimeout(state.transformer.destroy(), OPERATION_TIMEOUT_MS);
        } catch (err) {
          logger.warn('[BgEffects] Old transformer destroy error:', err);
        }
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
    // Reuse pre-initialized worker if available (saves ~6s of WASM+model load)
    const preWorker = consumePreInitWorker();
    if (preWorker) {
      transformer.setPreInitializedWorker(preWorker);
    }
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
 * Disable background effect — removes the processor from the track.
 *
 * CRITICAL ORDERING: stopProcessor() MUST be called BEFORE transformer.destroy().
 * If destroy() runs first, it breaks the TransformStream while frames are
 * still in-flight, stranding the last VideoFrame and freezing the video.
 *
 * stopProcessor() properly disconnects the LiveKit ProcessorWrapper,
 * restores the raw camera track, and THEN we clean up the transformer.
 */
export async function disableBackgroundEffect(track: VideoTrack): Promise<boolean> {
  if (!state.transformer && !state.processor) {
    state.isEnabled = false;
    return true;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    // 1. Stop the processor FIRST — restores raw camera track
    logger.info('[BgEffects] Stopping processor on track...');
    try {
      await withTimeout(track.stopProcessor(), OPERATION_TIMEOUT_MS);
    } catch (err) {
      logger.warn('[BgEffects] stopProcessor error (non-fatal):', err);
    }

    // 2. NOW destroy the transformer — safe because the TransformStream
    //    is already disconnected, no frames are in-flight
    if (state.transformer) {
      try {
        await withTimeout(state.transformer.destroy(), OPERATION_TIMEOUT_MS);
      } catch (err) {
        logger.warn('[BgEffects] Transformer destroy error (non-fatal):', err);
      }
    }

    state.transformer = null;
    state.processor = null;
    state.currentTrack = null;
    state.isEnabled = false;

    logger.info('[BgEffects] Processor fully removed — raw camera track restored');
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
 * Force cleanup (unmount or track change) — destroys transformer, worker, canvases.
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
  if (state.transformer) {
    try {
      await state.transformer.destroy();
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
