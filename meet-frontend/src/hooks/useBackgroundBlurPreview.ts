/**
 * useBackgroundBlurPreview — React hook for PreJoin canvas-based blur preview.
 *
 * Uses BackgroundBlurEngine to render processed video to a canvas overlay
 * positioned on top of the raw <video> element. The raw video is hidden
 * (opacity:0) and the canvas shows the composited result.
 *
 * Replaces the old usePreviewBackgroundBlur hook with GPU-only compositing.
 */

import { useEffect, useRef, useCallback } from 'react';
import { BackgroundBlurEngine, type BackgroundBlurOptions } from '../utils/backgroundBlurEngine';

export function useBackgroundBlurPreview(
  videoElement: HTMLVideoElement | null,
  options: BackgroundBlurOptions,
  mirror: boolean = false,
) {
  const engineRef = useRef<BackgroundBlurEngine | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const rafRef = useRef<number | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const mirrorRef = useRef(mirror);
  mirrorRef.current = mirror;

  // Initialize engine lazily
  const ensureEngine = useCallback(async () => {
    if (engineRef.current) return engineRef.current;
    const engine = new BackgroundBlurEngine(optionsRef.current);
    await engine.init();
    engineRef.current = engine;
    return engine;
  }, []);

  useEffect(() => {
    if (!videoElement) return;
    void ensureEngine();
  }, [videoElement, ensureEngine]);

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
      canvas.style.pointerEvents = 'none';
      canvas.style.display = 'none'; // hidden until first processed frame
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

    void ensureEngine();

    const processLoop = () => {
      const engine = engineRef.current;
      const opts = optionsRef.current;

      if (!engine || !videoElement.videoWidth || !videoElement.videoHeight || videoElement.readyState < 2) {
        rafRef.current = requestAnimationFrame(processLoop);
        return;
      }

      // Apply mirror transform to match the video element's CSS flip
      canvas.style.transform = mirrorRef.current ? 'scaleX(-1)' : 'none';

      // Match canvas to container size
      const container = videoElement.parentElement;
      if (container) {
        const rect = container.getBoundingClientRect();
        const cw = Math.floor(rect.width);
        const ch = Math.floor(rect.height);
        if (cw > 0 && ch > 0 && (canvas.width !== cw || canvas.height !== ch)) {
          canvas.width = cw;
          canvas.height = ch;
        }
      }

      if (canvas.style.display === 'none') {
        canvas.style.display = 'block';
        videoElement.style.opacity = '0';
      }

      // Sync options to engine
      engine.updateOptions(opts);

      // Process frame (throttled internally to 30 FPS)
      void engine.processFrame(videoElement, canvas, ctx, performance.now());

      rafRef.current = requestAnimationFrame(processLoop);
    };

    rafRef.current = requestAnimationFrame(processLoop);

    return cleanup;
  }, [videoElement, options.enabled, ensureEngine]);

  // Cleanup engine on unmount
  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, []);
}
