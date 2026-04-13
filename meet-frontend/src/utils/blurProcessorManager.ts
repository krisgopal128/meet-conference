/**
 * Blur Processor Manager - PROPER VERSION (BackgroundProcessor API)
 * 
 * Uses the modern BackgroundProcessor API with switchTo() method.
 * This keeps the processing pipeline alive between toggles, avoiding
 * the heavy TensorFlow.js model loading/unloading that causes hanging.
 * 
 * Key improvements:
 * 1. Initialize processor in 'disabled' mode ONCE
 * 2. Use switchTo() to toggle blur on/off (no stopProcessor/setProcessor loop)
 * 3. Async lock prevents race conditions
 * 4. Debounce guard prevents rapid toggling
 * 5. Proper cleanup only on final unmount
 * 
 * Reference:
 * https://github.com/livekit/track-processors-js/blob/main/processor-docs/video-processors.md
 */

import { 
  BackgroundProcessor,
  type BackgroundProcessorWrapper,
  supportsBackgroundProcessors,
} from '@livekit/track-processors';

interface VideoTrack {
  setProcessor: (processor: BackgroundProcessorWrapper) => Promise<void>;
  stopProcessor: () => Promise<void>;
}

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

// Minimum time between toggle operations (ms)
const DEBOUNCE_MS = 300;

// Lock release timeout (safety valve)
const LOCK_TIMEOUT_MS = 8000;

/**
 * Check browser support for background processors
 */
export function isBlurSupported(): boolean {
  return supportsBackgroundProcessors();
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
        console.warn('[BlurManager] ⚠️ Lock timeout, forcing release');
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
    console.log('[BlurManager] ⏸️ Toggle debounced (too fast)');
    return false;
  }
  return true;
}

/**
 * Enable background blur on a video track
 */
export async function enableBlur(track: VideoTrack): Promise<boolean> {
  // Debounce check
  if (!canToggle()) {
    return false;
  }

  // Prevent nested calls
  if (state.isApplying) {
    console.log('[BlurManager] ⏸️ Already applying, skipping enable');
    return false;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    console.log('[BlurManager] 🔄 Enabling blur...');
    
    // If processor exists and is already on this track, just switch mode
    if (state.processor && state.currentTrack === track) {
      console.log('[BlurManager] ♻️ Reusing existing processor');
      await state.processor.switchTo({ 
        mode: 'background-blur', 
        blurRadius: 10
      });
      state.isEnabled = true;
      console.log('[BlurManager] ✅ Blur enabled successfully (reused processor)');
      return true;
    }
    
    // Need to initialize or reinitialize
    // Clean up old processor if exists
    if (state.processor && state.currentTrack) {
      console.log('[BlurManager] 🧹 Cleaning up old processor');
      try {
        await state.currentTrack.stopProcessor();
      } catch {
        // Ignore
      }
      state.processor = null;
      state.currentTrack = null;
    }

    // Create processor in disabled mode first
    console.log('[BlurManager] 🔧 Initializing processor in disabled mode...');
    state.processor = BackgroundProcessor({ 
      mode: 'disabled',
    });
    
    // Attach to track
    await track.setProcessor(state.processor);
    state.currentTrack = track;
    
    // Now switch to blur mode
    await state.processor.switchTo({ 
      mode: 'background-blur', 
      blurRadius: 10
    });
    
    state.isEnabled = true;
    console.log('[BlurManager] ✅ Blur enabled successfully (via switchTo)');
    return true;
  } catch (e) {
    console.error('[BlurManager] ❌ Failed to enable blur:', e);
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
    console.log('[BlurManager] ⏸️ Already applying, skipping disable');
    return false;
  }

  // If no processor exists at all, nothing to disable
  if (!state.processor) {
    console.log('[BlurManager] ℹ️ No processor exists, blur already disabled');
    state.isEnabled = false;
    return true;
  }

  const releaseLock = await acquireLock();
  state.isApplying = true;
  state.lastToggleTime = Date.now();

  try {
    console.log('[BlurManager] 🔄 Disabling blur...');
    
    // Switch to disabled mode using switchTo() - keeps pipeline alive
    // We call this even if track reference differs, to ensure blur is actually off
    await state.processor!.switchTo({ mode: 'disabled' });
    
    state.isEnabled = false;
    console.log('[BlurManager] ✅ Blur disabled successfully (via switchTo)');
    return true;
  } catch (e) {
    console.error('[BlurManager] ❌ Failed to disable blur:', e);
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
export async function toggleBlur(
  track: VideoTrack,
  enabled: boolean
): Promise<boolean> {
  if (enabled) {
    return enableBlur(track);
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
  console.log('[BlurManager] 🧹 Force cleanup');
  
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
  console.log('[BlurManager] 🔄 Resetting for new track');
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
