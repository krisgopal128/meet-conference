/**
 * BackgroundBlurEngine — Core segmentation + compositing pipeline.
 *
 * Ports the Camera_BG_Blur sample's GPU-only compositing techniques:
 *  - MediaPipe Selfie Segmentation (landscape model)
 *  - Anti-halo knockout (person removed before blurring)
 *  - Anti-shadow 8x stacking (converges to opaque background)
 *  - Temporal EMA mask stabilization (prevents flicker)
 *  - Edge vignette (forces frame borders to background)
 *  - Edge feather (smooth subject cutout)
 *
 * Framework-agnostic: works with any HTMLVideoElement → HTMLCanvasElement pair.
 * Used by:
 *   - useBackgroundBlurPreview (PreJoin canvas preview)
 *   - livekitBackgroundProcessor (transmitted track)
 */

import logger from '../utils/logger';

// ─── Types ───────────────────────────────────────────

export type BackgroundMode = 'blur' | 'image' | 'color' | 'none';

export interface BackgroundBlurOptions {
  enabled: boolean;
  mode: BackgroundMode;
  blurRadius: number; // 0–40 px
  feather: number; // 3–8 px
  bgColor: string; // hex for 'color' mode
  bgImage: HTMLImageElement | null; // for 'image' mode
}

export const DEFAULT_BLUR_OPTIONS: BackgroundBlurOptions = {
  enabled: true,
  mode: 'blur',
  blurRadius: 14,
  feather: 3,
  bgColor: '#1e1e2e',
  bgImage: null,
};

// ─── MediaPipe script loader (local first, CDN fallback) ───────────

const CDN_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation';
const SCRIPT_URL = `${CDN_BASE}/selfie_segmentation.js`;
let scriptLoadPromise: Promise<void> | null = null;

/** Global SelfieSegmentation type provided by the CDN script */
type SelfieSegmentationInstance = {
  setOptions: (opts: { modelSelection: number; selfieMode: boolean }) => void;
  onResults: (cb: (results: SegmentationResults) => void) => void;
  send: (input: { image: HTMLVideoElement | HTMLCanvasElement }) => Promise<void>;
  close: () => Promise<void>;
};

interface SegmentationResults {
  image: CanvasImageSource;
  segmentationMask: HTMLCanvasElement;
}

declare global {
  interface Window {
    SelfieSegmentation?: new (config: {
      locateFile: (file: string) => string;
    }) => SelfieSegmentationInstance;
  }
}

async function loadSelfieSegmentationScript(): Promise<void> {
  if (typeof window !== 'undefined' && window.SelfieSegmentation) return;
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load MediaPipe Selfie Segmentation script'));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

// ─── Mask stabilization constants ────────────────────

const MASK_EMA = 0.5;
const MASK_EDGE_MARGIN = 0.08;
const MAX_FPS = 30;
const FRAME_INTERVAL = 1000 / MAX_FPS;
const STACK_COUNT = 8;

// ─── Engine ──────────────────────────────────────────

export class BackgroundBlurEngine {
  private segmentation: SelfieSegmentationInstance | null = null;
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
  }

  get options(): BackgroundBlurOptions {
    return this.optionsRef;
  }

  updateOptions(patch: Partial<BackgroundBlurOptions>): void {
    this.optionsRef = { ...this.optionsRef, ...patch };
  }

  /**
   * Initialize the MediaPipe Selfie Segmentation model.
   * Must be called before processFrame().
   */
  async init(): Promise<void> {
    if (this.segmentation) return;

    await loadSelfieSegmentationScript();
    if (!window.SelfieSegmentation) {
      throw new Error('SelfieSegmentation not available after script load');
    }

    this.segmentation = new window.SelfieSegmentation({
      locateFile: (file: string) => `${CDN_BASE}/${file}`,
    });
    this.segmentation.setOptions({ modelSelection: 1, selfieMode: false });
    this.segmentation.onResults((results) => this.onResults(results));

    logger.info('[BackgroundBlurEngine] Segmentation model loaded');
  }

  /**
   * Process a single frame from a video element to an output canvas.
   * Throttled to MAX_FPS. Safe to call every requestAnimationFrame.
   */
  async processFrame(
    video: HTMLVideoElement,
    output: HTMLCanvasElement,
    outputCtx: CanvasRenderingContext2D,
    now: number,
  ): Promise<void> {
    if (!this.segmentation || !this.optionsRef.enabled) {
      outputCtx.drawImage(video, 0, 0, output.width, output.height);
      return;
    }

    if (now - this.lastProcess < FRAME_INTERVAL) return;
    this.lastProcess = now;

    if (video.readyState < 2) return;

    await this.processToCanvas(video, output, outputCtx);
  }

  /**
   * Promise-based frame processing — draws source to output canvas
   * with the full compositing pipeline. No throttling — caller controls rate.
   * Used by the LiveKit track transformer.
   */
  async processToCanvas(
    source: HTMLCanvasElement | HTMLVideoElement,
    output: HTMLCanvasElement,
    outputCtx: CanvasRenderingContext2D,
  ): Promise<void> {
    if (!this.segmentation || !this.optionsRef.enabled) {
      outputCtx.drawImage(source, 0, 0, output.width, output.height);
      return;
    }

    // Set output refs BEFORE send — onResults fires during send()
    this._currentOutput = output;
    this._currentOutputCtx = outputCtx;

    try {
      await this.segmentation.send({ image: source });
    } catch (err) {
      logger.warn('[BackgroundBlurEngine] Frame processing failed:', err);
      outputCtx.drawImage(source, 0, 0, output.width, output.height);
    }
  }

  // Instance refs used during onResults callback
  private _currentOutput: HTMLCanvasElement | null = null;
  private _currentOutputCtx: CanvasRenderingContext2D | null = null;

  /**
   * Called by MediaPipe when segmentation results are ready.
   * Performs the full compositing pipeline.
   */
  private onResults(results: SegmentationResults): void {
    const output = this._currentOutput;
    const ctx = this._currentOutputCtx;
    if (!output || !ctx) return;

    const w = output.width;
    const h = output.height;
    const source = results.image;

    if (!this.optionsRef.enabled) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(source, 0, 0, w, h);
      return;
    }

    // Size working canvases to match output
    for (const c of [this.bgCanvas, this.personCanvas, this.knockoutCanvas, this.blurCanvas]) {
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
    }

    // 1. Stabilize mask (EMA + vignette)
    const mask = this.stabilizeMask(results.segmentationMask);

    // 2. Render background (blur/image/color/none with anti-halo)
    this.renderBackground(source, mask, w, h);

    // 3. Sharp person cutout with feather
    this.personCtx.save();
    this.personCtx.clearRect(0, 0, w, h);
    this.personCtx.drawImage(source, 0, 0, w, h);
    this.personCtx.globalCompositeOperation = 'destination-in';
    if (this.optionsRef.feather > 0) {
      this.personCtx.filter = `blur(${this.optionsRef.feather}px)`;
    }
    this.personCtx.drawImage(mask, 0, 0, w, h);
    this.personCtx.filter = 'none';
    this.personCtx.restore();

    // 4. Composite to output
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(this.bgCanvas, 0, 0);
    ctx.drawImage(this.personCanvas, 0, 0);
  }

  // ─── Mask Stabilization ─────────────────────────

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
        // (1) Knockout person from frame copy
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

        // (3) Stack 8x for fully opaque background
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
    if (this.segmentation) {
      void this.segmentation.close();
      this.segmentation = null;
    }
    this._currentOutput = null;
    this._currentOutputCtx = null;
  }
}
