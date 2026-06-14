/**
 * useBackgroundBlurPreview — React hook for PreJoin canvas-based blur preview.
 *
 * Uses a Web Worker for segmentation + BackgroundBlurEngine for compositing.
 * Segmentation runs off the main thread to prevent UI freezes.
 */

import { useEffect, useRef } from 'react';
import { BackgroundBlurEngine, type BackgroundBlurOptions } from '../utils/backgroundBlurEngine';
import { createSegmentationWorker } from '../utils/segmentationWorkerFactory';

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

    // Create engine (compositing only, no segmentation)
    if (!engineRef.current) {
      engineRef.current = new BackgroundBlurEngine(optionsRef.current);
    }

    // Create worker for segmentation
    if (!workerRef.current) {
      workerRef.current = createSegmentationWorker();

      workerRef.current.onmessage = (e: MessageEvent) => {
        const msg = e.data;
        if (msg.type === 'ready') {
          workerReadyRef.current = true;
        } else if (msg.type === 'mask') {
          lastMaskRef.current = {
            pixels: new Uint8Array(msg.mask),
            w: msg.maskW,
            h: msg.maskH,
          };
          isFrameInFlightRef.current = false;
        } else if (msg.type === 'error') {
          isFrameInFlightRef.current = false;
        }
      };

      workerRef.current.postMessage({ type: 'init' });
    }

    const processLoop = async () => {
      const engine = engineRef.current;
      const opts = optionsRef.current;

      if (!engine || !videoElement.videoWidth || !videoElement.videoHeight || videoElement.readyState < 2) {
        rafRef.current = requestAnimationFrame(processLoop);
        return;
      }

      canvas.style.transform = mirrorRef.current ? 'scaleX(-1)' : 'none';
      canvas.style.objectFit = fitModeRef.current;

      const vw = videoElement.videoWidth;
      const vh = videoElement.videoHeight;
      if (vw > 0 && vh > 0 && (canvas.width !== vw || canvas.height !== vh)) {
        canvas.width = vw;
        canvas.height = vh;
      }

      if (canvas.style.display === 'none') {
        canvas.style.display = 'block';
        videoElement.style.opacity = '0';
      }

      engine.updateOptions(opts);

      // Send frame to worker for segmentation (non-blocking)
      if (workerReadyRef.current && !isFrameInFlightRef.current) {
        try {
          isFrameInFlightRef.current = true;
          const bitmap = await createImageBitmap(videoElement, 0, 0, vw, vh);
          if (workerRef.current && workerReadyRef.current) {
            workerRef.current.postMessage(
              { type: 'segment', bitmap, timestamp: performance.now() },
              [bitmap],
            );
          } else {
            bitmap.close();
            isFrameInFlightRef.current = false;
          }
        } catch {
          isFrameInFlightRef.current = false;
        }
      }

      // Composite with last available mask
      const mask = lastMaskRef.current;
      if (mask) {
        engine.compositeWithMask(videoElement, canvas, ctx, mask.pixels, mask.w, mask.h);
      } else {
        ctx.drawImage(videoElement, 0, 0);
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
