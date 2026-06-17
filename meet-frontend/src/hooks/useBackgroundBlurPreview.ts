/**
 * useBackgroundBlurPreview — React hook for PreJoin canvas-based blur preview.
 *
 * Uses a Web Worker for segmentation + BackgroundBlurEngine for compositing.
 *
 * The worker is pre-initialized when the video element becomes available,
 * so blur is instant when the user toggles it on (~6s model load happens
 * in the background before the user interacts).
 */

import { useEffect, useRef } from 'react';
import { BackgroundBlurEngine, type BackgroundBlurOptions } from '../utils/backgroundBlurEngine';
import logger from '../utils/logger';

interface MaskData {
  pixels: Uint8Array;
  w: number;
  h: number;
}

export function useBackgroundBlurPreview(
  videoElement: HTMLVideoElement | null,
  options: BackgroundBlurOptions,
  mirror: boolean = false,
  fitMode: 'cover' | 'contain' = 'cover',
) {
  const engineRef = useRef<BackgroundBlurEngine | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const workerReadyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mirrorRef = useRef(mirror);
  mirrorRef.current = mirror;
  const fitModeRef = useRef(fitMode);
  fitModeRef.current = fitMode;
  const lastMaskRef = useRef<MaskData | null>(null);
  const isFrameInFlightRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Effect 1: Pre-initialize the worker IMMEDIATELY on mount (not waiting for video element).
  // The worker only needs the video element for segmentation frames, not for model loading.
  // Starting early saves 2-5s (camera init time) of wasted idle.
  useEffect(() => {
    if (workerRef.current) return;

    logger.info('[useBackgroundBlurPreview] Pre-initializing segmentation worker...');
    const worker = new Worker(
      new URL('../utils/segmentationWorker.ts', import.meta.url),
      { type: 'module' },
    );

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data;
      if (msg.type === 'ready') {
        workerReadyRef.current = true;
        retryCountRef.current = 0;
        logger.info('[useBackgroundBlurPreview] Worker ready — segmentation active');
      } else if (msg.type === 'mask') {
        lastMaskRef.current = {
          pixels: new Uint8Array(msg.mask),
          w: msg.maskW,
          h: msg.maskH,
        };
        isFrameInFlightRef.current = false;
      } else if (msg.type === 'error') {
        isFrameInFlightRef.current = false;
        logger.warn('[useBackgroundBlurPreview] Worker segment error:', msg.error);
        // Retry init up to 3 times (covers transient WASM/model load failures)
        if (retryCountRef.current < 3 && !retryTimerRef.current) {
          retryCountRef.current++;
          logger.info(`[useBackgroundBlurPreview] Retrying worker init (attempt ${retryCountRef.current}/3)...`);
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            worker.postMessage({ type: 'init' });
          }, 2000);
        }
      }
    };

    worker.onerror = (e) => {
      logger.error('[useBackgroundBlurPreview] Worker load error:', e.message);
    };

    worker.postMessage({ type: 'init' });
    workerRef.current = worker;
  }, []);

  // Effect 2: Canvas + render loop — only when blur is enabled
  useEffect(() => {
    if (!videoElement) return;

    const cleanup = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (canvasRef.current) {
        canvasRef.current.remove();
        canvasRef.current = null;
      }
      videoElement.style.opacity = '1';
      ctxRef.current = null;
      lastMaskRef.current = null;
      isFrameInFlightRef.current = false;
    };

    if (!optionsRef.current.enabled) {
      cleanup();
      return;
    }

    // Create canvas overlay
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.objectFit = fitModeRef.current;
      canvas.style.pointerEvents = 'none';
      canvas.style.zIndex = '5';
      canvas.style.display = 'none';
      videoElement.parentElement?.appendChild(canvas);
      canvasRef.current = canvas;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        canvas.remove();
        canvasRef.current = null;
        return;
      }
      ctxRef.current = ctx;
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx) return;

    // Create engine (compositing only)
    if (!engineRef.current) {
      engineRef.current = new BackgroundBlurEngine(optionsRef.current);
    }

    // Synchronous render loop
    const processLoop = () => {
      const engine = engineRef.current;
      const opts = optionsRef.current;

      if (!engine || !videoElement.videoWidth || !videoElement.videoHeight || videoElement.readyState < 2) {
        rafRef.current = requestAnimationFrame(processLoop);
        return;
      }

      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;

      if (canvas.width !== vw) canvas.width = vw;
      if (canvas.height !== vh) canvas.height = vh;

      if (canvas.style.display === 'none') {
        canvas.style.display = 'block';
        videoElement.style.opacity = '0';
      }

      canvas.style.transform = mirrorRef.current ? 'scaleX(-1)' : 'none';
      canvas.style.objectFit = fitModeRef.current;

      engine.updateOptions(opts);

      // Fire-and-forget: send frame to worker
      if (workerReadyRef.current && !isFrameInFlightRef.current) {
        isFrameInFlightRef.current = true;
        createImageBitmap(videoElement, 0, 0, vw, vh)
          .then((bitmap) => {
            if (workerRef.current && workerReadyRef.current) {
              workerRef.current.postMessage(
                { type: 'segment', bitmap, timestamp: performance.now() },
                [bitmap],
              );
            } else {
              bitmap.close();
              isFrameInFlightRef.current = false;
            }
          })
          .catch(() => {
            isFrameInFlightRef.current = false;
          });
      }

      // Synchronous compositing with last available mask
      const mask = lastMaskRef.current;
      if (mask) {
        engine.compositeWithMask(videoElement, canvas, ctx, mask.pixels, mask.w, mask.h);
      } else {
        ctx.drawImage(videoElement, 0, 0, vw, vh);
      }

      rafRef.current = requestAnimationFrame(processLoop);
    };

    rafRef.current = requestAnimationFrame(processLoop);

    return cleanup;
  }, [videoElement, options.enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (workerRef.current) {
        workerRef.current.postMessage({ type: 'destroy' });
        workerRef.current.terminate();
        workerRef.current = null;
      }
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
      workerReadyRef.current = false;
      lastMaskRef.current = null;
    };
  }, []);
}
