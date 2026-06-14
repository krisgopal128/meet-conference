/**
 * Segmentation Worker — runs MediaPipe ImageSegmenter inference OFF the main thread.
 *
 * Receives ImageBitmap frames from the main thread, runs segmentation,
 * and returns the mask as a Uint8Array (transferable, zero-copy).
 *
 * The main thread handles only canvas compositing (~3ms), keeping UI responsive.
 */

interface InitMessage {
  type: 'init';
}

interface SegmentMessage {
  type: 'segment';
  bitmap: ImageBitmap;
  timestamp: number;
}

interface UpdateMessage {
  type: 'destroy';
}

type WorkerMessage = InitMessage | SegmentMessage | UpdateMessage;

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

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  if (msg.type === 'init') {
    try {
      await ensureInit();
      (self as unknown as Worker).postMessage({ type: 'ready' });
    } catch (err) {
      (self as unknown as Worker).postMessage({ type: 'error', error: String(err) });
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

      // Transfer the underlying buffer back (zero-copy)
      const buffer = maskPixels.buffer.slice(0);
      (self as unknown as Worker).postMessage(
        {
          type: 'mask',
          mask: buffer,
          maskW,
          maskH,
        },
        [buffer],
      );
    } catch (err) {
      (self as unknown as Worker).postMessage({ type: 'error', error: String(err) });
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
