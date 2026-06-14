/**
 * BackgroundBlurEngine — Core segmentation + compositing pipeline.
 *
 * Uses @mediapipe/tasks-vision (ImageSegmenter) with local WASM + model files.
 * Ports the Camera_BG_Blur sample's GPU-only compositing techniques:
 *  - Anti-halo knockout (person removed before blurring)
 *  - Anti-shadow 8x stacking (converges to opaque background)
 *  - Temporal EMA mask stabilization (prevents flicker)
 *  - Edge vignette (forces frame borders to background)
 *  - Edge feather (smooth subject cutout)
 */

import logger from './logger';

// ─── Types ───────────────────────────────────────────

export type BackgroundMode = 'blur' | 'image' | 'color' | 'none';

export interface BackgroundBlurOptions {
  enabled: boolean;
  mode: BackgroundMode;
  blurRadius: number;
  feather: number;
  bgColor: string;
  bgImage: HTMLImageElement | null;
}

export const DEFAULT_BLUR_OPTIONS: BackgroundBlurOptions = {
  enabled: true,
  mode: 'blur',
  blurRadius: 14,
  feather: 3,
  bgColor: '#1e1e2e',
  bgImage: null,
};

// ─── Constants ───────────────────────────────────────

const MASK_EMA = 0.5;
const MASK_EDGE_MARGIN = 0.08;
const MAX_FPS = 30;
const FRAME_INTERVAL = 1000 / MAX_FPS;
const STACK_COUNT = 3;

// ─── Engine ──────────────────────────────────────────

export class BackgroundBlurEngine {
  private segmenter: any = null;
  private optionsRef: BackgroundBlurOptions;

  // Offscreen working canvases
  private bgCanvas: HTMLCanvasElement;
  private bgCtx: CanvasRenderingContext2D;
  private personCanvas: HTMLCanvasElement;
  private personCtx: CanvasRenderingContext2D;
  private knockoutCanvas: HTMLCanvasElement;
  private knockoutCtx: CanvasRenderingContext2D;
  private blurCanvas: HTMLCanvasElement;
  private blurCtx: CanvasRenderingContext2D;
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;

  // Mask stabilization state
  private maskStable: HTMLCanvasElement | null = null;
  private maskStableCtx: CanvasRenderingContext2D | null = null;
  private maskWork: HTMLCanvasElement | null = null;
  private maskWorkCtx: CanvasRenderingContext2D | null = null;
  private vignette: HTMLCanvasElement | null = null;
  private maskW = 0;
  private maskH = 0;
  private maskInit = false;

  // FPS throttling
  private lastProcess = 0;

  constructor(options: Partial<BackgroundBlurOptions> = {}) {
    this.optionsRef = { ...DEFAULT_BLUR_OPTIONS, ...options };

    this.bgCanvas = document.createElement('canvas');
    this.bgCtx = this.bgCanvas.getContext('2d')!;
    this.personCanvas = document.createElement('canvas');
    this.personCtx = this.personCanvas.getContext('2d')!;
    this.knockoutCanvas = document.createElement('canvas');
    this.knockoutCtx = this.knockoutCanvas.getContext('2d')!;
    this.blurCanvas = document.createElement('canvas');
    this.blurCtx = this.blurCanvas.getContext('2d')!;
    this.maskCanvas = document.createElement('canvas');
    this.maskCtx = this.maskCanvas.getContext('2d')!;
  }

  get options(): BackgroundBlurOptions {
    return this.optionsRef;
  }

  updateOptions(patch: Partial<BackgroundBlurOptions>): void {
    this.optionsRef = { ...this.optionsRef, ...patch };
  }

  /**
   * Initialize the MediaPipe ImageSegmenter with local WASM + model.
   */
  async init(): Promise<void> {
    if (this.segmenter) return;

    try {
      const vision = await import('@mediapipe/tasks-vision');

      let wasmFileset: any;
      try {
        wasmFileset = await vision.FilesetResolver.forVisionTasks('/wasm');
      } catch {
        wasmFileset = await vision.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
        );
      }

      // NOTE: Must use CPU delegate. GPU delegate produces a WebGL texture
      // mask (not Uint8Array), which this 2D-canvas pipeline cannot read.
      // hasUint8Array() returns false for GPU → blur silently skipped.
      const opts: any = {
        baseOptions: {
          modelAssetPath: '/models/selfie_segmenter.tflite',
          delegate: 'CPU',
        },
        outputCategoryMask: true,
        runningMode: 'VIDEO',
      };

      try {
        this.segmenter = await vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
      } catch {
        opts.baseOptions.modelAssetPath =
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
        this.segmenter = await vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
      }

      logger.info('[BackgroundBlurEngine] ImageSegmenter initialized');
    } catch (err) {
      logger.error('[BackgroundBlurEngine] Failed to init:', err);
      throw err;
    }
  }

  /**
   * Process a frame from a video element. Throttled to 30 FPS.
   */
  async processFrame(
    video: HTMLVideoElement,
    output: HTMLCanvasElement,
    outputCtx: CanvasRenderingContext2D,
    now: number,
  ): Promise<void> {
    if (!this.segmenter || !this.optionsRef.enabled) {
      outputCtx.drawImage(video, 0, 0, output.width, output.height);
      return;
    }

    if (now - this.lastProcess < FRAME_INTERVAL) return;
    this.lastProcess = now;

    if (video.readyState < 2) return;

    await this.processToCanvas(video, output, outputCtx);
  }

  /**
   * Core processing: segment → stabilize mask → composite. No throttling.
   */
  async processToCanvas(
    source: HTMLCanvasElement | HTMLVideoElement,
    output: HTMLCanvasElement,
    outputCtx: CanvasRenderingContext2D,
  ): Promise<void> {
    if (!this.segmenter || !this.optionsRef.enabled) {
      outputCtx.drawImage(source, 0, 0, output.width, output.height);
      return;
    }

    const w = output.width;
    const h = output.height;
    const opts = this.optionsRef;

    try {
      // 1. Segment — must pass monotonically increasing timestamp in milliseconds
      const result = this.segmenter.segmentForVideo(source, performance.now());
      const categoryMask = result.categoryMask;

      if (!categoryMask || !categoryMask.hasUint8Array?.()) {
        outputCtx.drawImage(source, 0, 0, w, h);
        result.close?.();
        return;
      }

      const maskPixels = categoryMask.getAsUint8Array();
      const maskW = categoryMask.width ?? 256;
      const maskH = categoryMask.height ?? 256;
      result.close?.();

      // 2. Convert mask to canvas (person=white opaque, bg=transparent)
      this.convertMaskToCanvas(maskPixels, maskW, maskH);

      // 3. Stabilize mask (EMA temporal + edge vignette)
      const mask = this.stabilizeMask(this.maskCanvas);

      // Size working canvases
      for (const c of [this.bgCanvas, this.personCanvas, this.knockoutCanvas, this.blurCanvas]) {
        if (c.width !== w) c.width = w;
        if (c.height !== h) c.height = h;
      }

      // 4. Render background (anti-halo knockout → blur → 8x stack)
      this.renderBackground(source, mask, w, h);

      // 5. Sharp person cutout with feather
      this.personCtx.save();
      this.personCtx.clearRect(0, 0, w, h);
      this.personCtx.drawImage(source, 0, 0, w, h);
      this.personCtx.globalCompositeOperation = 'destination-in';
      if (opts.feather > 0) {
        this.personCtx.filter = `blur(${opts.feather}px)`;
      }
      this.personCtx.drawImage(mask, 0, 0, w, h);
      this.personCtx.filter = 'none';
      this.personCtx.restore();

      // 6. Composite to output
      outputCtx.clearRect(0, 0, w, h);
      outputCtx.drawImage(this.bgCanvas, 0, 0);
      outputCtx.drawImage(this.personCanvas, 0, 0);
    } catch (err) {
      logger.warn('[BackgroundBlurEngine] Frame failed:', err);
      outputCtx.drawImage(source, 0, 0, w, h);
    }
  }

  // ─── Mask Conversion ─────────────────────────────

  private convertMaskToCanvas(maskPixels: Uint8Array, mw: number, mh: number): void {
    if (this.maskCanvas.width !== mw) this.maskCanvas.width = mw;
    if (this.maskCanvas.height !== mh) this.maskCanvas.height = mh;

    const imageData = this.maskCtx.createImageData(mw, mh);
    const data = imageData.data;

    for (let i = 0; i < maskPixels.length; i++) {
      const isPerson = maskPixels[i] === 0; // 0 = person in this selfie segmenter model output
      const idx = i * 4;
      if (isPerson) {
        data[idx] = 255;
        data[idx + 1] = 255;
        data[idx + 2] = 255;
        data[idx + 3] = 255;
      } else {
        data[idx] = 0;
        data[idx + 1] = 0;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
      }
    }

    this.maskCtx.putImageData(imageData, 0, 0);
  }

  // ─── Mask Stabilization ──────────────────────────

  private resetMaskSmoother(): void {
    this.maskStable = null;
    this.maskStableCtx = null;
    this.maskWork = null;
    this.maskWorkCtx = null;
    this.vignette = null;
    this.maskW = 0;
    this.maskH = 0;
    this.maskInit = false;
  }

  private stabilizeMask(rawMask: HTMLCanvasElement): HTMLCanvasElement {
    const mw = rawMask.width;
    const mh = rawMask.height;

    if (!this.maskStable || this.maskW !== mw || this.maskH !== mh) {
      this.maskStable = document.createElement('canvas');
      this.maskStable.width = mw;
      this.maskStable.height = mh;
      this.maskStableCtx = this.maskStable.getContext('2d');

      this.maskWork = document.createElement('canvas');
      this.maskWork.width = mw;
      this.maskWork.height = mh;
      this.maskWorkCtx = this.maskWork.getContext('2d');

      // Build border-suppression vignette
      this.vignette = document.createElement('canvas');
      this.vignette.width = mw;
      this.vignette.height = mh;
      const vCtx = this.vignette.getContext('2d')!;
      const m = MASK_EDGE_MARGIN;
      const hg = vCtx.createLinearGradient(0, 0, mw, 0);
      hg.addColorStop(0, 'rgba(255,255,255,0)');
      hg.addColorStop(m, 'rgba(255,255,255,1)');
      hg.addColorStop(1 - m, 'rgba(255,255,255,1)');
      hg.addColorStop(1, 'rgba(255,255,255,0)');
      vCtx.fillStyle = hg;
      vCtx.fillRect(0, 0, mw, mh);
      vCtx.globalCompositeOperation = 'destination-in';
      const vg = vCtx.createLinearGradient(0, 0, 0, mh);
      vg.addColorStop(0, 'rgba(255,255,255,0)');
      vg.addColorStop(m, 'rgba(255,255,255,1)');
      vg.addColorStop(1 - m, 'rgba(255,255,255,1)');
      vg.addColorStop(1, 'rgba(255,255,255,0)');
      vCtx.fillStyle = vg;
      vCtx.fillRect(0, 0, mw, mh);
      vCtx.globalCompositeOperation = 'source-over';

      this.maskW = mw;
      this.maskH = mh;
      this.maskInit = false;
    }

    const stableCtx = this.maskStableCtx!;
    const workCtx = this.maskWorkCtx!;

    // (1) Temporal EMA via additive compositing
    if (!this.maskInit) {
      stableCtx.clearRect(0, 0, mw, mh);
      stableCtx.drawImage(rawMask, 0, 0, mw, mh);
      this.maskInit = true;
    } else {
      workCtx.clearRect(0, 0, mw, mh);
      workCtx.globalCompositeOperation = 'lighter';
      workCtx.globalAlpha = 1 - MASK_EMA;
      workCtx.drawImage(this.maskStable, 0, 0, mw, mh);
      workCtx.globalAlpha = MASK_EMA;
      workCtx.drawImage(rawMask, 0, 0, mw, mh);
      workCtx.globalAlpha = 1;
      workCtx.globalCompositeOperation = 'source-over';

      stableCtx.clearRect(0, 0, mw, mh);
      stableCtx.drawImage(this.maskWork!, 0, 0, mw, mh);
    }

    // (2) Apply border vignette
    workCtx.clearRect(0, 0, mw, mh);
    workCtx.drawImage(this.maskStable, 0, 0, mw, mh);
    workCtx.globalCompositeOperation = 'destination-in';
    if (this.vignette) {
      workCtx.drawImage(this.vignette, 0, 0, mw, mh);
    }
    workCtx.globalCompositeOperation = 'source-over';

    return this.maskWork!;
  }

  // ─── Background Rendering ────────────────────────

  private renderBackground(
    source: CanvasImageSource,
    mask: HTMLCanvasElement,
    w: number,
    h: number,
  ): void {
    const c = this.bgCtx;
    const opts = this.optionsRef;
    c.clearRect(0, 0, w, h);

    switch (opts.mode) {
      case 'blur': {
        // (1) Knockout person from frame copy (anti-halo)
        this.knockoutCtx.save();
        this.knockoutCtx.clearRect(0, 0, w, h);
        this.knockoutCtx.globalCompositeOperation = 'source-over';
        this.knockoutCtx.drawImage(source, 0, 0, w, h);
        this.knockoutCtx.globalCompositeOperation = 'destination-out';
        this.knockoutCtx.drawImage(mask, 0, 0, w, h);
        this.knockoutCtx.restore();

        // (2) Blur the knockout
        this.blurCtx.save();
        this.blurCtx.clearRect(0, 0, w, h);
        this.blurCtx.filter = `blur(${opts.blurRadius}px)`;
        this.blurCtx.drawImage(this.knockoutCanvas, 0, 0, w, h);
        this.blurCtx.filter = 'none';
        this.blurCtx.restore();

        // (3) Stack 8x for fully opaque background (anti-shadow)
        c.save();
        c.clearRect(0, 0, w, h);
        for (let i = 0; i < STACK_COUNT; i++) {
          c.drawImage(this.blurCanvas, 0, 0, w, h);
        }
        c.restore();
        break;
      }
      case 'image': {
        if (opts.bgImage) {
          this.drawCover(c, opts.bgImage, w, h);
        } else {
          c.fillStyle = opts.bgColor;
          c.fillRect(0, 0, w, h);
        }
        break;
      }
      case 'color': {
        c.fillStyle = opts.bgColor;
        c.fillRect(0, 0, w, h);
        break;
      }
      case 'none':
      default: {
        c.drawImage(source, 0, 0, w, h);
        break;
      }
    }
  }

  private drawCover(c: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number): void {
    const imgEl = img as HTMLImageElement;
    const iw = imgEl.naturalWidth || (img as HTMLVideoElement).videoWidth || (img as HTMLCanvasElement).width;
    const ih = imgEl.naturalHeight || (img as HTMLVideoElement).videoHeight || (img as HTMLCanvasElement).height;
    if (!iw || !ih) return;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    c.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }

  // ─── Lifecycle ───────────────────────────────────

  destroy(): void {
    this.resetMaskSmoother();
    if (this.segmenter) {
      try {
        this.segmenter.close?.();
      } catch {
        // ignore
      }
      this.segmenter = null;
    }
  }
}
