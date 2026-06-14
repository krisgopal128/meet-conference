/**
 * Segmentation Worker Factory — creates a CLASSIC Web Worker (not module)
 * that runs MediaPipe ImageSegmenter inference OFF the main thread.
 *
 * MediaPipe internally calls importScripts() which is only available in
 * classic workers, NOT module workers. This factory builds the worker
 * via a Blob URL with plain JavaScript that uses importScripts().
 *
 * The worker:
 *   1. Loads MediaPipe tasks-vision JS from CDN via importScripts()
 *   2. Loads WASM files from local /wasm/ or falls back to CDN
 *   3. Receives ImageBitmap frames → segments → returns mask Uint8Array
 */

export interface MaskResult {
  type: 'mask';
  mask: ArrayBuffer;
  maskW: number;
  maskH: number;
}

export interface WorkerReady {
  type: 'ready';
}

export interface WorkerError {
  type: 'error';
  error: string;
}

export type WorkerResponse = MaskResult | WorkerReady | WorkerError;

const MP_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

const workerSource = `
let segmenter = null;
let initializing = null;

async function ensureInit() {
  if (segmenter) return;
  if (initializing) return initializing;

  initializing = (async () => {
    // Load MediaPipe JS library (works in classic worker via importScripts)
    importScripts('${MP_CDN}/vision_bundle.js');

    // The global is exposed as 'Vision' on self in classic worker
    const Vision = self.Vision;
    if (!Vision) throw new Error('MediaPipe Vision not found after importScripts');

    let wasmFileset;
    try {
      wasmFileset = await Vision.FilesetResolver.forVisionTasks('/wasm');
    } catch (e) {
      wasmFileset = await Vision.FilesetResolver.forVisionTasks('${MP_CDN}/wasm');
    }

    const opts = {
      baseOptions: {
        modelAssetPath: '/models/selfie_segmenter.tflite',
        delegate: 'CPU',
      },
      outputCategoryMask: true,
      runningMode: 'VIDEO',
    };

    try {
      segmenter = await Vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
    } catch (e) {
      opts.baseOptions.modelAssetPath =
        'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
      segmenter = await Vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
    }
  })();

  return initializing;
}

self.onmessage = async function(e) {
  var msg = e.data;

  if (msg.type === 'init') {
    try {
      await ensureInit();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }

  if (msg.type === 'segment') {
    try {
      if (!segmenter) {
        msg.bitmap.close();
        return;
      }

      var result = segmenter.segmentForVideo(msg.bitmap, msg.timestamp);
      var categoryMask = result.categoryMask;

      if (!categoryMask || !categoryMask.hasUint8Array || !categoryMask.hasUint8Array()) {
        if (result.close) result.close();
        msg.bitmap.close();
        return;
      }

      var maskPixels = categoryMask.getAsUint8Array();
      var maskW = categoryMask.width || 256;
      var maskH = categoryMask.height || 256;
      if (result.close) result.close();
      msg.bitmap.close();

      // Transfer buffer back (zero-copy)
      var buffer = maskPixels.buffer.slice(0);
      self.postMessage(
        { type: 'mask', mask: buffer, maskW: maskW, maskH: maskH },
        [buffer]
      );
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
    return;
  }

  if (msg.type === 'destroy') {
    if (segmenter) {
      try { segmenter.close(); } catch (e) {}
      segmenter = null;
    }
    initializing = null;
  }
};
`;

let cachedBlobUrl: string | null = null;

function getWorkerUrl(): string {
  if (!cachedBlobUrl) {
    const blob = new Blob([workerSource], { type: 'application/javascript' });
    cachedBlobUrl = URL.createObjectURL(blob);
  }
  return cachedBlobUrl;
}

export function createSegmentationWorker(): Worker {
  return new Worker(getWorkerUrl());
}

export function revokeWorkerUrl(): void {
  if (cachedBlobUrl) {
    URL.revokeObjectURL(cachedBlobUrl);
    cachedBlobUrl = null;
  }
}
