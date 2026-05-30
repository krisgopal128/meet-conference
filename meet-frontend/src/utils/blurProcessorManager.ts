/**
 * Blur Processor Manager - LAZY-LOADED VERSION
 * 
 * Defers loading of @livekit/track-processors (TensorFlow.js, ~184KB)
 * until blur is actually requested. This keeps the critical room-entry
 * path fast — the blur chunk only loads when the user enables blur.
 * 
 * Uses the modern BackgroundProcessor API with switchTo() method.
 * This keeps the processing pipeline alive between toggles, avoiding
 * the heavy TensorFlow.js model loading/unloading that causes hanging.
 * 
 * Key improvements:
 * 1. Lazy-load @livekit/track-processors only when blur is toggled
 * 2. Initialize processor in 'disabled' mode ONCE
 * 3. Use switchTo() to toggle blur on/off (no stopProcessor/setProcessor loop)
 * 4. Async lock prevents race conditions
 * 5. Debounce guard prevents rapid toggling
 * 6. Proper cleanup only on final unmount
 * 
 * Reference:
 * https://github.com/livekit/track-processors-js/blob/main/processor-docs/video-processors.md
 */

import logger from './logger';

interface VideoTrack {
  setProcessor: (processor: any) => Promise<void>;
  stopProcessor: () => Promise<void>;
}

// Lazily loaded track-processors types (resolved at runtime)
type BackgroundProcessorWrapper = any;
type TrackProcessorsModule = typeof import('@livekit/track-processors');

interface BlurManagerState {
  processor: BackgroundProcessorWrapper | null;
  currentTrack: VideoTrack | null;
  lockPromise: Promise<void> | null;
  lastToggleTime: number;
  isApplying: boolean;
  isEnabled: boolean;
}

const state: BlurManagerState = {
  processor: null,
  currentTrack: null,
  lockPromise: null,
  lastToggleTime: 0,
  isApplying: false,
  isEnabled: false,
};

// Cached dynamic import — loads once, reused after that
let trackProcessorsCache: TrackProcessorsModule | null = null;
let trackProcessorsLoading: Promise<TrackProcessorsModule> | null = null;

/**
 * Lazy-load @livekit/track-processors (TensorFlow.js ~184KB).
 * Only triggers a network request the first time; subsequent calls
 * resolve immediately from the cache.
 */
async function loadTrackProcessors(): Promise<TrackProcessorsModule> {
  if (trackProcessorsCache) return trackProcessorsCache;
  if (trackProcessorsLoading) return trackProcessorsLoading;
  
  trackProcessorsLoading = import('@livekit/track-processors').then((mod) => {
    trackProcessorsCache = mod;
    trackProcessorsLoading = null;
    return mod;
  });
  
  return trackProcessorsLoading;
}

const LOCAL_ASSET_PATHS = {
  modelAssetPath: '/models/selfie_segmenter.tflite',
};

const DEBOUNCE_MS = 300;

// Lock release timeout (safety valve)
const LOCK_TIMEOUT_MS = 8000;

/**
 * Check browser support for background processors.
 * This triggers the lazy load of track-processors.
 */
export async function isBlurSupported(): Promise<boolean> {
  try {
    const { supportsBackgroundProcessors } = await loadTrackProcessors();
    return supportsBackgroundProcessors();
  } catch {
    return false;
  }
}

/**
 * Synchronous check — returns false if track-processors hasn't been loaded yet.
 * Useful for UI that checks blur state without triggering a chunk load.
 */
export function isBlurLoaded(): boolean {
  return trackProcessorsCache !== null;
}

/**
 * Acquire async lock for blur operations
 */
async function acquireLock(): Promise<() => void> {
  // Wait for any existing operation to complete
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
    // Safety valve: auto-release after timeout
    safetyTimeout = setTimeout(() => {
      if (state.lockPromise) {
        logger.warn('[BlurManager] ⚠️ Lock timeout, forcing release');
        state.isApplying = false;
        safetyTimeout = null;
        resolve();
      }
    }, LOCK_TIMEOUT_MS);
  });

  return releaseLock;
}

/**
 * Check if toggle is allowed (debounce)
 */
function canToggle(): boolean {
  const now = Date.now();
  if (now - state.lastToggleTime < DEBOUNCE_MS) {
    logger.info('[BlurManager] ⏸️ Toggle debounced (too fast)');
    return false;
  }
  return true;
}

/**
 * Enable background blur on a video track
 * @param track - the video track to apply blur to
 * @param participantCount - optional participant count for adaptive blur radius
 */
export async function enableBlur(track: VideoTrack, participantCount?: number, blurRadiusOverride?: number): Promise<boolean> {
  // Debounce check
  if (!canToggle()) {
    return false;
  }

  // Prevent nested calls
  if (state.isApplying) {
    logger.info('[BlurManager] ⏸️ Already applying, skipping enable');
    return false;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    logger.info('[BlurManager] 🔄 Enabling blur...');
    
    // Lazy-load track-processors (TensorFlow.js) on first use
    const { BackgroundProcessor } = await loadTrackProcessors();
    
    // If processor exists and is already on this track, just switch mode
    if (state.processor && state.currentTrack === track) {
      logger.info('[BlurManager] ♻️ Reusing existing processor');
      const blurRadius = blurRadiusOverride ?? (participantCount !== undefined
        ? getAdaptiveBlurRadius(participantCount) || 10
        : 10);
      await state.processor.switchTo({
        mode: 'background-blur',
        blurRadius,
      });
      state.isEnabled = true;
      logger.info('[BlurManager] ✅ Blur enabled successfully (reused processor)');
      return true;
    }
    
    // Need to initialize or reinitialize
    // Clean up old processor if exists
    if (state.processor && state.currentTrack) {
      logger.info('[BlurManager] 🧹 Cleaning up old processor');
      try {
        await state.currentTrack.stopProcessor();
      } catch {
        // Ignore
      }
      state.processor = null;
      state.currentTrack = null;
    }

    // Create processor in disabled mode first
    logger.info('[BlurManager] 🔧 Initializing processor in disabled mode...');
    state.processor = BackgroundProcessor({ 
      mode: 'disabled',
      assetPaths: LOCAL_ASSET_PATHS,
    });
    
    // Attach to track
    await track.setProcessor(state.processor);
    state.currentTrack = track;
    
    // Now switch to blur mode
    const blurRadius = blurRadiusOverride ?? (participantCount !== undefined
      ? getAdaptiveBlurRadius(participantCount) || 10
      : 10);
    await state.processor.switchTo({
      mode: 'background-blur',
      blurRadius,
    });
    
    state.isEnabled = true;
    logger.info('[BlurManager] ✅ Blur enabled successfully (via switchTo)');
    return true;
  } catch (e) {
    logger.error('[BlurManager] ❌ Failed to enable blur:', e);
    return false;
  } finally {
    state.isApplying = false;
    releaseLock();
  }
}

/**
 * Disable background blur on a video track
 */
export async function disableBlur(_track: VideoTrack): Promise<boolean> {
  // Debounce check
  if (!canToggle()) {
    return false;
  }

  // Prevent nested calls
  if (state.isApplying) {
    logger.info('[BlurManager] ⏸️ Already applying, skipping disable');
    return false;
  }

  // If no processor exists at all, nothing to disable
  if (!state.processor) {
    logger.info('[BlurManager] ℹ️ No processor exists, blur already disabled');
    state.isEnabled = false;
    return true;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    logger.info('[BlurManager] 🔄 Disabling blur...');
    
    // Switch to disabled mode using switchTo() - keeps pipeline alive
    // We call this even if track reference differs, to ensure blur is actually off
    await state.processor!.switchTo({ mode: 'disabled' });
    
    state.isEnabled = false;
    logger.info('[BlurManager] ✅ Blur disabled successfully (via switchTo)');
    return true;
  } catch (e) {
    logger.error('[BlurManager] ❌ Failed to disable blur:', e);
    // Even on error, reset the enabled state
    state.isEnabled = false;
    return false;
  } finally {
    state.isApplying = false;
    releaseLock();
  }
}

/**
 * Toggle background blur
 */
export function toggleBlur(
  track: VideoTrack,
  enabled: boolean,
  participantCount?: number,
  blurRadiusOverride?: number,
): Promise<boolean> {
  if (enabled) {
    return enableBlur(track, participantCount, blurRadiusOverride);
  } else {
    return disableBlur(track);
  }
}

/**
 * Get current blur state
 */
export function isBlurEnabled(): boolean {
  return state.isEnabled;
}

/**
 * Check if an operation is in progress
 */
export function isBlurApplying(): boolean {
  return state.isApplying;
}

/**
 * Force cleanup (for unmount or track change)
 * Only call this when completely done with the processor
 */
export async function forceCleanup(track?: VideoTrack): Promise<void> {
  logger.info('[BlurManager] 🧹 Force cleanup');
  
  const targetTrack = track || state.currentTrack;
  if (targetTrack) {
    try {
      await targetTrack.stopProcessor();
    } catch {
      // Ignore
    }
  }
  
  state.processor = null;
  state.currentTrack = null;
  state.lockPromise = null;
  state.isApplying = false;
  state.isEnabled = false;
}

/**
 * Reset state when switching cameras (call before enabling blur on new camera)
 */
export async function resetForNewTrack(): Promise<void> {
  logger.info('[BlurManager] 🔄 Resetting for new track');
  if (state.currentTrack) {
    try {
      await state.currentTrack.stopProcessor();
    } catch {
      // Ignore
    }
  }
  state.processor = null;
  state.currentTrack = null;
  state.isEnabled = false;
  state.isApplying = false;
}

/** Threshold above which blur is auto-disabled to save CPU */
const BLUR_AUTO_DISABLE_THRESHOLD = 9;

/**
 * Check if blur should be auto-disabled based on participant count.
 * Blur is expensive — disable for large calls to save CPU.
 * @param participantCount - current number of participants in the room
 * @returns whether blur should be disabled
 */
export function shouldAutoDisableBlur(participantCount: number): boolean {
  return participantCount >= BLUR_AUTO_DISABLE_THRESHOLD;
}

/**
 * Detect if the device is low-end and blur should be avoided.
 * Uses navigator.hardwareConcurrency and deviceMemory as proxies.
 * @returns true if device appears to be low-end
 */
export function isLowEndDevice(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const cores = nav.hardwareConcurrency ?? 4;
    const memory = nav.deviceMemory ?? 4;

    // Low-end: 2 or fewer CPU cores, or 2GB or less RAM
    if (cores <= 2) return true;
    if (memory <= 2) return true;

    // No WebGL2 support indicates very old/weak GPU
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    canvas.remove();
    if (!gl) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Get recommended blur radius based on participant count.
 * Higher participant counts get lower blur radius to save CPU.
 * @param participantCount - current participant count
 * @returns blur radius (0 means caller should check shouldAutoDisableBlur instead)
 */
export function getAdaptiveBlurRadius(participantCount: number): number {
  if (participantCount <= 4) return 10;
  if (participantCount <= 8) return 7;
  return 0;
}
