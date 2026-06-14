/**
 * SelfieSegmentationTransformer — extends VideoTransformer from
 * @livekit/track-processors to provide a LiveKit-compatible video processor.
 *
 * ARCHITECTURE: Segmentation runs in a Web Worker to prevent main-thread
 * freezes. Each frame is pipelined:
 *
 *   Frame N arrives
 *     ├─► createImageBitmap(frame) → postMessage to worker (non-blocking)
 *     ├─► composite(outputCanvas, lastMaskFromWorker)  [~3ms, main thread]
 *     └─► new VideoFrame(outputCanvas) → enqueue
 *
 *   Worker (parallel, ~15-30ms):
 *     segmentForVideo(bitmap) → mask Uint8Array → postMessage back
 *
 * The main thread is never blocked by inference. There is a 1-frame
 * latency on the mask which is visually imperceptible.
 */

import { VideoTransformer } from '@livekit/track-processors';
import { BackgroundBlurEngine, type BackgroundMode } from './backgroundBlurEngine';
import logger from './logger';

export interface SelfieSegmentationOptions extends Record<string, unknown> {
  enabled: boolean;
  mode: BackgroundMode;
  blurRadius: number;
  feather: number;
  bgColor: string;
  bgImagePath: string | null;
}

interface MaskData {
  pixels: Uint8Array;
  w: number;
  h: number;
}

export class SelfieSegmentationTransformer extends VideoTransformer<SelfieSegmentationOptions> {
  declare options: SelfieSegmentationOptions;
  private engine: BackgroundBlurEngine | null = null;
  private workCanvas: HTMLCanvasElement;
  private workCtx: CanvasRenderingContext2D;
  private outputCanvas: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;
  private bgImageEl: HTMLImageElement | null = null;

  // Worker pipeline state
  private worker: Worker | null = null;
  private workerReady = false;
  private lastMask: MaskData | null = null;
  private isFrameInFlight = false;

  constructor(options: Partial<SelfieSegmentationOptions> = {}) {
    super();
    this.options = {
      enabled: true,
      mode: 'blur',
      blurRadius: 14,
      feather: 3,
      bgColor: '#1e1e2e',
      bgImagePath: null,
      ...options,
    };
    this.workCanvas = document.createElement('canvas');
    this.workCtx = this.workCanvas.getContext('2d', { alpha: false })!;
    this.outputCanvas = document.createElement('canvas');
    this.outputCtx = this.outputCanvas.getContext('2d', { alpha: false })!;
  }

  override async init({
    outputCanvas,
    inputElement,
  }: {
    outputCanvas: OffscreenCanvas | HTMLCanvasElement;
    inputElement: HTMLVideoElement;
  }): Promise<void> {
    await super.init({ outputCanvas, inputElement });

    this.engine = new BackgroundBlurEngine({
      enabled: this.options.enabled,
      mode: this.options.mode,
      blurRadius: this.options.blurRadius,
      feather: this.options.feather,
      bgColor: this.options.bgColor,
      bgImage: this.bgImageEl,
    });

    // Spawn the segmentation worker (Vite-bundled module worker with importScripts polyfill)
    this.worker = new Worker(new URL('./segmentationWorker.ts', import.meta.url), { type: 'module' });

    this.worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        this.workerReady = true;
        logger.info('[SelfieSegmentationTransformer] Worker ready');
      } else if (msg.type === 'mask') {
        this.lastMask = {
          pixels: new Uint8Array(msg.mask),
          w: msg.maskW,
          h: msg.maskH,
        };
        this.isFrameInFlight = false;
      } else if (msg.type === 'error') {
        logger.warn('[SelfieSegmentationTransformer] Worker error:', msg.error);
        this.isFrameInFlight = false;
      }
    };

    this.worker.postMessage({ type: 'init' });

    if (this.options.bgImagePath) {
      await this.loadBackgroundImage(this.options.bgImagePath);
    }
  }

  private async loadBackgroundImage(path: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      const timeout = setTimeout(() => {
        logger.warn('[SelfieSegmentationTransformer] Image load timeout:', path);
        resolve();
      }, 5000);

      img.onload = () => {
        clearTimeout(timeout);
        this.bgImageEl = img;
        this.engine?.updateOptions({ bgImage: img });
        resolve();
      };
      img.onerror = () => {
        clearTimeout(timeout);
        logger.warn('[SelfieSegmentationTransformer] Failed to load bg image:', path);
        resolve();
      };
      img.src = path;
    });
  }

  override async transform(
    frame: VideoFrame,
    controller: TransformStreamDefaultController<VideoFrame>,
  ): Promise<void> {
    if (!this.engine) {
      controller.enqueue(frame);
      return;
    }

    const w = frame.displayWidth;
    const h = frame.displayHeight;

    if (w === 0 || h === 0) {
      controller.enqueue(frame);
      return;
    }

    // Size canvases
    if (this.workCanvas.width !== w) this.workCanvas.width = w;
    if (this.workCanvas.height !== h) this.workCanvas.height = h;
    if (this.outputCanvas.width !== w) this.outputCanvas.width = w;
    if (this.outputCanvas.height !== h) this.outputCanvas.height = h;

    // Draw incoming frame to work canvas
    this.workCtx.drawImage(frame, 0, 0);

    // Fire-and-forget: send frame to worker for segmentation (non-blocking)
    if (this.workerReady && !this.isFrameInFlight) {
      this.isFrameInFlight = true;
      createImageBitmap(this.workCanvas, 0, 0, w, h)
        .then((bitmap) => {
          if (this.worker && this.workerReady) {
            this.worker.postMessage(
              { type: 'segment', bitmap, timestamp: performance.now() },
              [bitmap],
            );
          } else {
            bitmap.close();
            this.isFrameInFlight = false;
          }
        })
        .catch(() => {
          this.isFrameInFlight = false;
        });
    }

    // SYNCHRONOUS compositing using last available mask
    if (this.lastMask) {
      this.engine.compositeWithMask(
        this.workCanvas,
        this.outputCanvas,
        this.outputCtx,
        this.lastMask.pixels,
        this.lastMask.w,
        this.lastMask.h,
      );
    } else {
      this.outputCtx.drawImage(this.workCanvas, 0, 0);
    }

    const newFrame = new VideoFrame(this.outputCanvas, {
      timestamp: frame.timestamp,
      duration: frame.duration ?? undefined,
    });

    frame.close();
    controller.enqueue(newFrame);
  }

  override async update(options: Partial<SelfieSegmentationOptions>): Promise<void> {
    const oldImagePath = this.options.bgImagePath;
    this.options = { ...this.options, ...options };

    if (options.bgImagePath && options.bgImagePath !== oldImagePath) {
      await this.loadBackgroundImage(options.bgImagePath);
    }

    if (this.engine) {
      this.engine.updateOptions({
        enabled: this.options.enabled,
        mode: this.options.mode,
        blurRadius: this.options.blurRadius,
        feather: this.options.feather,
        bgColor: this.options.bgColor,
        bgImage: this.bgImageEl,
      });
    }
  }

  override async destroy(): Promise<void> {
    await super.destroy();

    if (this.worker) {
      this.worker.postMessage({ type: 'destroy' });
      this.worker.terminate();
      this.worker = null;
    }

    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }

    this.lastMask = null;
    this.workerReady = false;
    logger.info('[SelfieSegmentationTransformer] Destroyed');
  }
}
