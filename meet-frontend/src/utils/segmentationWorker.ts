/**
 * Segmentation Worker — runs MediaPipe ImageSegmenter OFF the main thread.
 *
 * This is a MODULE worker (bundled by Vite) with an importScripts() polyfill
 * because MediaPipe internally calls importScripts() to load WASM glue JS,
 * which doesn't exist in module workers.
 *
 * The polyfill (below) MUST run before any MediaPipe code. Since we use
 * dynamic import() (not static import), the polyfill executes first.
 */

// ─── importScripts polyfill for module workers ─────────────────────
// In module workers, importScripts() exists as a function but THROWS when called.
// We must always override it with a working implementation.
const _self = self as unknown as { importScripts: (...urls: string[]) => void };
_self.importScripts = function (...urls: string[]): void {
    for (const url of urls) {
      let resolved = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (!url.startsWith('/')) resolved = '/' + url;
        resolved = self.location.origin + resolved;
      }
      const xhr = new XMLHttpRequest();
      xhr.open('GET', resolved, false);
      try {
        xhr.send();
      } catch (e) {
        throw new Error(`importScripts failed: ${resolved} (${(e as Error).message})`);
      }
      if (xhr.status >= 200 && xhr.status < 400) {
        try {
          (0, eval)(xhr.responseText);
        } catch (e) {
          throw new Error(`importScripts eval error: ${resolved}: ${(e as Error).message}`);
        }
      } else {
        throw new Error(`importScripts HTTP ${xhr.status}: ${resolved}`);
      }
    }
  };

// ─── Segmentation logic ────────────────────────────────────────────

let segmenter: any = null;
let initializing: Promise<void> | null = null;

async function ensureInit(): Promise<void> {
  if (segmenter) return;
  if (initializing) return initializing;

  initializing = (async () => {
    const vision = await import('@mediapipe/tasks-vision');

    let wasmFileset: any;
    try {
      wasmFileset = await vision.FilesetResolver.forVisionTasks('/wasm');
    } catch {
      wasmFileset = await vision.FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm',
      );
    }

    const opts: any = {
      baseOptions: {
        modelAssetPath: '/models/selfie_segmenter.tflite',
        delegate: 'CPU',
      },
      outputCategoryMask: true,
      runningMode: 'VIDEO',
    };

    try {
      segmenter = await vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
    } catch {
      opts.baseOptions.modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
      segmenter = await vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
    }
  })();

  return initializing;
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      await ensureInit();
      (self as unknown as Worker).postMessage({ type: 'ready' });
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === 'segment') {
    try {
      if (!segmenter) {
        msg.bitmap.close();
        return;
      }

      const result = segmenter.segmentForVideo(msg.bitmap, msg.timestamp);
      const categoryMask = result.categoryMask;

      if (!categoryMask || !categoryMask.hasUint8Array?.()) {
        result.close?.();
        msg.bitmap.close();
        return;
      }

      const maskPixels = categoryMask.getAsUint8Array();
      const maskW = categoryMask.width ?? 256;
      const maskH = categoryMask.height ?? 256;
      result.close?.();
      msg.bitmap.close();

      const buffer = maskPixels.buffer.slice(0);
      (self as unknown as Worker).postMessage(
        { type: 'mask', mask: buffer, maskW, maskH },
        [buffer],
      );
    } catch (err) {
      (self as unknown as Worker).postMessage({
        type: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return;
  }

  if (msg.type === 'destroy') {
    if (segmenter) {
      try {
        segmenter.close?.();
      } catch {
        // ignore
      }
      segmenter = null;
    }
    initializing = null;
  }
};
