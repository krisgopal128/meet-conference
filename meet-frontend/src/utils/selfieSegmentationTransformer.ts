/**
 * SelfieSegmentationTransformer — extends VideoTransformer from
 * @livekit/track-processors to provide a LiveKit-compatible video processor
 * that uses MediaPipe Selfie Segmentation (the sample's approach) with
 * the BackgroundBlurEngine's full GPU compositing pipeline.
 *
 * Pipeline: VideoFrame → drawImage → engine.processToCanvas → new VideoFrame
 *
 * Usage:
 *   const transformer = new SelfieSegmentationTransformer({ ... });
 *   const processor = new ProcessorWrapper(transformer, 'selfie-segmentation');
 *   await track.setProcessor(processor);
 *   processor.updateTransformerOptions({ blurRadius: 20 });
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

export class SelfieSegmentationTransformer extends VideoTransformer<SelfieSegmentationOptions> {
  declare options: SelfieSegmentationOptions;
  private engine: BackgroundBlurEngine | null = null;
  private workCanvas: HTMLCanvasElement;
  private workCtx: CanvasRenderingContext2D;
  private outputCtx: CanvasRenderingContext2D | null = null;
  private bgImageEl: HTMLImageElement | null = null;

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
  }

  override async init({
    outputCanvas,
    inputElement,
  }: {
    outputCanvas: OffscreenCanvas | HTMLCanvasElement;
    inputElement: HTMLVideoElement;
  }): Promise<void> {
    await super.init({ outputCanvas, inputElement });

    if (outputCanvas instanceof HTMLCanvasElement) {
      this.outputCtx = outputCanvas.getContext('2d', { alpha: false });
    }

    this.engine = new BackgroundBlurEngine({
      enabled: this.options.enabled,
      mode: this.options.mode,
      blurRadius: this.options.blurRadius,
      feather: this.options.feather,
      bgColor: this.options.bgColor,
      bgImage: this.bgImageEl,
    });

    try {
      await this.engine.init();
      logger.info('[SelfieSegmentationTransformer] Engine initialized');

      // Load background image if specified
      if (this.options.bgImagePath) {
        await this.loadBackgroundImage(this.options.bgImagePath);
      }
    } catch (err) {
      logger.error('[SelfieSegmentationTransformer] Failed to init engine:', err);
      this.engine = null;
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
    if (!this.engine || !this.canvas || !this.outputCtx) {
      controller.enqueue(frame);
      return;
    }

    const w = frame.displayWidth;
    const h = frame.displayHeight;

    if (w === 0 || h === 0) {
      controller.enqueue(frame);
      return;
    }

    // Size canvases to match frame
    if (this.workCanvas.width !== w) this.workCanvas.width = w;
    if (this.workCanvas.height !== h) this.workCanvas.height = h;
    const canvas = this.canvas as HTMLCanvasElement;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    try {
      // Draw incoming VideoFrame to work canvas
      this.workCtx.drawImage(frame, 0, 0);

      // Process through engine (segmentation + compositing)
      await this.engine.processToCanvas(this.workCanvas, canvas, this.outputCtx);

      // Create new VideoFrame from processed canvas
      const newFrame = new VideoFrame(canvas, {
        timestamp: frame.timestamp,
        duration: frame.duration ?? undefined,
      });

      frame.close();
      controller.enqueue(newFrame);
    } catch (err) {
      logger.warn('[SelfieSegmentationTransformer] Transform error, passing through:', err);
      controller.enqueue(frame);
    }
  }

  override async update(options: Partial<SelfieSegmentationOptions>): Promise<void> {
    const oldImagePath = this.options.bgImagePath;
    this.options = { ...this.options, ...options };

    // Load new background image if changed
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
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.outputCtx = null;
    logger.info('[SelfieSegmentationTransformer] Destroyed');
  }
}
