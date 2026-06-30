import { useEffect, useRef } from 'react';
import logger from '../utils/logger';

interface PreviewBlurOptions {
  enabled: boolean;
  blurRadius?: number;
  fitMode?: 'cover' | 'contain';
}

export function usePreviewBackgroundBlur(
  videoElement: HTMLVideoElement | null,
  options: PreviewBlurOptions
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationRef = useRef<number | null>(null);
  const segmenterRef = useRef<any>(null);
  const segmenterReadyRef = useRef(false);
  const segmenterLoadingRef = useRef(false);
  const segCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sharpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const activeRef = useRef(false);

  const ensureSegmenter = async () => {
    if (segmenterRef.current || segmenterLoadingRef.current) return;
    segmenterLoadingRef.current = true;
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
      const opts: any = {
        baseOptions: {
          modelAssetPath: '/models/selfie_segmenter.tflite',
          delegate: 'GPU',
        },
        outputCategoryMask: true,
        runningMode: 'IMAGE',
      };
      try {
        segmenterRef.current = await vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
      } catch {
        opts.baseOptions.modelAssetPath =
          'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
        segmenterRef.current = await vision.ImageSegmenter.createFromOptions(wasmFileset, opts);
      }
      segmenterReadyRef.current = true;
      logger.info('[PreviewBlur] Segmenter ready');
    } catch (e) {
      logger.warn('[PreviewBlur] Failed to load segmenter:', e);
    }
    segmenterLoadingRef.current = false;
  };

  useEffect(() => {
    if (!videoElement) return;
    void ensureSegmenter();
  }, [videoElement]);

  useEffect(() => {
    if (!videoElement) return;

    const cleanup = () => {
      activeRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
      videoElement.style.opacity = '1';
      ctxRef.current = null;
      blurCanvasRef.current = null;
      sharpCanvasRef.current = null;
      segCanvasRef.current = null;
      segmenterRef.current?.close?.();
      segmenterRef.current = null;
    };

    if (!optionsRef.current.enabled) {
      cleanup();
      return;
    }

    activeRef.current = true;

    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.transform = 'scaleX(-1)';
      canvas.style.display = 'none';
      videoElement.parentElement?.appendChild(canvas);
      canvasRef.current = canvas;

      const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
      if (!ctx) {
        canvas.remove();
        canvasRef.current = null;
        activeRef.current = false;
        return;
      }
      ctxRef.current = ctx;
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx) { activeRef.current = false; return; }

    const SEG_W = 160;

    void ensureSegmenter();

    const processFrame = () => {
      if (!activeRef.current) return;

      const now = performance.now();
      if (now - lastFrameTimeRef.current < 33) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastFrameTimeRef.current = now;

      if (
        !videoElement.videoWidth ||
        !videoElement.videoHeight ||
        videoElement.readyState < 2
      ) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (!segmenterReadyRef.current) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (canvas.style.display === 'none') {
        canvas.style.display = 'block';
        videoElement.style.opacity = '0';
      }

      const container = videoElement.parentElement;
      if (!container) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;
      const containerRect = container.getBoundingClientRect();
      const cw = Math.floor(containerRect.width);
      const ch = Math.floor(containerRect.height);

      if (cw === 0 || ch === 0) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }

      const fitMode = optionsRef.current.fitMode ?? 'cover';
      const blurRadius = optionsRef.current.blurRadius ?? 10;

      let srcX = 0, srcY = 0, srcW = vw, srcH = vh;

      const videoAspect = vw / vh;
      const containerAspect = cw / ch;

      if (fitMode === 'contain') {
        // no crop
      } else {
        if (videoAspect > containerAspect) {
          srcH = vh; srcW = vh * containerAspect;
          srcX = (vw - srcW) / 2;
        } else {
          srcW = vw; srcH = vw / containerAspect;
          srcY = (vh - srcH) / 2;
        }
      }

      const segH = Math.round(SEG_W * (srcH / srcW));

      if (!segCanvasRef.current) {
        segCanvasRef.current = document.createElement('canvas');
      }
      const segC = segCanvasRef.current;
      segC.width = SEG_W;
      segC.height = segH;
      const segCtx = segC.getContext('2d', { alpha: false, desynchronized: true })!;
      segCtx.drawImage(videoElement, srcX, srcY, srcW, srcH, 0, 0, SEG_W, segH);

      try {
        const result = segmenterRef.current.segment(segC);
        const categoryMask = result.categoryMask;

        if (!blurCanvasRef.current) {
          blurCanvasRef.current = document.createElement('canvas');
          sharpCanvasRef.current = document.createElement('canvas');
        }
        const blurC = blurCanvasRef.current!;
        const sharpC = sharpCanvasRef.current!;

        blurC.width = cw;
        blurC.height = ch;
        sharpC.width = cw;
        sharpC.height = ch;

        const blurCtx = blurC.getContext('2d', { alpha: false, desynchronized: true })!;
        blurCtx.filter = `blur(${blurRadius}px)`;
        blurCtx.drawImage(videoElement, srcX, srcY, srcW, srcH, 0, 0, cw, ch);
        blurCtx.filter = 'none';

        const sharpCtx = sharpC.getContext('2d', { alpha: false, desynchronized: true })!;
        sharpCtx.drawImage(videoElement, srcX, srcY, srcW, srcH, 0, 0, cw, ch);

        ctx.drawImage(blurC, 0, 0);

        const sharpData = sharpCtx.getImageData(0, 0, cw, ch);
        const outData = ctx.getImageData(0, 0, cw, ch);

        const maskW = categoryMask?.width ?? 0;
        const maskH = categoryMask?.height ?? 0;

        if (maskW > 0 && maskH > 0 && categoryMask?.hasUint8Array?.()) {
          const maskPixels = categoryMask.getAsUint8Array();

          const out = outData.data;
          const sharp = sharpData.data;

          for (let y = 0; y < ch; y++) {
            const maskY = Math.min(Math.floor(y * maskH / ch), maskH - 1);
            for (let x = 0; x < cw; x++) {
              const maskX = Math.min(Math.floor(x * maskW / cw), maskW - 1);
              const mi = maskY * maskW + maskX;
              const isPerson = maskPixels[mi] === 0;
              if (isPerson) {
                const oi = (y * cw + x) * 4;
                out[oi] = sharp[oi];
                out[oi + 1] = sharp[oi + 1];
                out[oi + 2] = sharp[oi + 2];
              }
            }
          }
        }

        ctx.putImageData(outData, 0, 0);
        categoryMask?.close?.();
      } catch (e) {
        ctx.drawImage(videoElement, srcX, srcY, srcW, srcH, 0, 0, cw, ch);
      }

      animationRef.current = requestAnimationFrame(processFrame);
    };

    animationRef.current = requestAnimationFrame(processFrame);

    return cleanup;
  }, [videoElement, options.enabled]);
}
