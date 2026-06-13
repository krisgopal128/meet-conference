import { useEffect, useRef } from 'react';
import logger from '../utils/logger';

// Type declarations for Insertable Streams API (Chrome 94+)
// Only declare if not already defined in lib.dom.d.ts
declare global {
  class MediaStreamTrackProcessor {
    constructor(options: { track: MediaStreamTrack });
    readonly readable: ReadableStream<VideoFrame>;
  }

  class MediaStreamTrackGenerator {
    constructor(options: { kind: 'video' | 'audio' });
    readonly writable: WritableStream<VideoFrame>;
    readonly track: MediaStreamTrack;
  }
}

/**
 * Lightweight video filter that applies temporal blending to reduce rolling shutter artifacts.
 * 
 * This filter blends the current frame with the previous frame to smooth out
 * rolling shutter "jello" effects caused by CMOS sensor row-by-row readout.
 * 
 * Settings:
 * - blendFactor: 0.3 (30% previous frame, 70% current frame)
 * - blur: 0 (disabled)
 * - contrast: 100% (no adjustment)
 */

interface LightweightFilterOptions {
  enabled: boolean;
  blendFactor?: number; // 0-1, default 0.3
  fitMode?: 'cover' | 'contain'; // default 'cover'
  targetFps?: number; // default 30, throttled for large calls
  participantCount?: number; // auto-reduce for large calls
}

/**
 * Apply lightweight temporal blend filter to a video element using Canvas.
 * This is for LOCAL PREVIEW ONLY - it doesn't affect transmitted video.
 */
export function useLightweightPreviewFilter(
  videoElement: HTMLVideoElement | null,
  options: LightweightFilterOptions
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const prevImageDataRef = useRef<ImageData | null>(null);
  const animationRef = useRef<number | null>(null);
  const processCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const processCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastVideoSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastSrcObjectRef = useRef<MediaStream | null>(null);
  const lastFitModeRef = useRef<'cover' | 'contain' | null>(null);
  const lastContainerSizeRef = useRef<{ width: number; height: number } | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  
  // Use refs for options to avoid re-creating the effect when they change
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    if (!videoElement) {
      return;
    }

    const cleanup = () => {
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
      prevImageDataRef.current = null;
      processCanvasRef.current = null;
      processCtxRef.current = null;
      lastVideoSizeRef.current = null;
      lastSrcObjectRef.current = null;
      lastFitModeRef.current = null;
      lastContainerSizeRef.current = null;
    };

    if (!optionsRef.current.enabled) {
      cleanup();
      return;
    }

    // Create canvas overlay only once
    if (!canvasRef.current) {
      const canvas = document.createElement('canvas');
      canvas.style.position = 'absolute';
      canvas.style.inset = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.pointerEvents = 'none';
      canvas.style.transform = 'scaleX(-1)'; // Mirror to match video

      // Insert canvas after video element
      videoElement.parentElement?.appendChild(canvas);
      canvasRef.current = canvas;

      const ctx = canvas.getContext('2d', { alpha: false, willReadFrequently: true });
      if (!ctx) {
        canvas.remove();
        return;
      }
      ctxRef.current = ctx;
    }

    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!ctx) return;

    const processFrame = () => {
      const currentOptions = optionsRef.current;
      const pc = currentOptions.participantCount ?? 0;

      // Auto-reduce for large calls
      const effectiveTargetFps = pc >= 9 ? 15 : (currentOptions.targetFps ?? 30);
      const blendFactor = pc >= 9 ? 0 : (currentOptions.blendFactor ?? 0.3);
      const fitMode = currentOptions.fitMode ?? 'cover';

      // FPS throttling: skip frame if not enough time has elapsed
      const now = performance.now();
      const minInterval = 1000 / effectiveTargetFps;
      if (now - lastFrameTimeRef.current < minInterval) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }
      lastFrameTimeRef.current = now;

      // Check if video has valid data
      if (!videoElement.videoWidth || !videoElement.videoHeight) {
        if (ctx.canvas.width > 0 && ctx.canvas.height > 0) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Check if video has enough data to render (HAVE_CURRENT_DATA = 2 or higher)
      if (videoElement.readyState < 2) {
        if (ctx.canvas.width > 0 && ctx.canvas.height > 0) {
          ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        }
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const container = videoElement.parentElement;
      if (!container) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      const videoWidth = videoElement.videoWidth;
      const videoHeight = videoElement.videoHeight;
      const currentSrcObject = videoElement.srcObject as MediaStream | null;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = Math.floor(containerRect.width);
      const containerHeight = Math.floor(containerRect.height);

      // Check if fitMode changed - reset filter state for clean transition
      if (lastFitModeRef.current !== null && lastFitModeRef.current !== fitMode) {
        logger.info('[LightweightFilter] Fit mode changed, resetting filter state');
        prevImageDataRef.current = null;
        processCanvasRef.current = null;
        processCtxRef.current = null;
      }
      lastFitModeRef.current = fitMode;

      // Check if container size changed - reset process canvas
      if (lastContainerSizeRef.current && 
          (lastContainerSizeRef.current.width !== containerWidth || 
           lastContainerSizeRef.current.height !== containerHeight)) {
        logger.info('[LightweightFilter] Container size changed, resetting process canvas');
        processCanvasRef.current = null;
        processCtxRef.current = null;
        prevImageDataRef.current = null;
      }
      lastContainerSizeRef.current = { width: containerWidth, height: containerHeight };

      // Check if srcObject changed (new track attached) - reset state
      if (lastSrcObjectRef.current !== currentSrcObject) {
        if (lastSrcObjectRef.current !== null) {
          logger.info('[LightweightFilter] Video srcObject changed, resetting filter state');
          prevImageDataRef.current = null;
          processCanvasRef.current = null;
          processCtxRef.current = null;
          lastVideoSizeRef.current = null;
        }
        lastSrcObjectRef.current = currentSrcObject;
      }

      // Check if video dimensions changed
      if (lastVideoSizeRef.current && 
          (lastVideoSizeRef.current.width !== videoWidth || 
           lastVideoSizeRef.current.height !== videoHeight)) {
        logger.info('[LightweightFilter] Video dimensions changed, resetting filter state');
        prevImageDataRef.current = null;
        processCanvasRef.current = null;
        processCtxRef.current = null;
      }
      lastVideoSizeRef.current = { width: videoWidth, height: videoHeight };

      // Process at half resolution to reduce CPU load by ~75%
      const PROCESS_SCALE = 0.5;
      const processWidth = Math.max(1, Math.floor(containerWidth * PROCESS_SCALE));
      const processHeight = Math.max(1, Math.floor(containerHeight * PROCESS_SCALE));

      // Match canvas size to container
      if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
        canvas.width = containerWidth;
        canvas.height = containerHeight;
        // Reset prevImageData when canvas resizes to avoid blending mismatched sizes
        prevImageDataRef.current = null;
      }

      // Create offscreen canvas for processing at reduced resolution
      if (!processCanvasRef.current || 
          processCanvasRef.current.width !== processWidth || 
          processCanvasRef.current.height !== processHeight) {
        processCanvasRef.current = document.createElement('canvas');
        processCanvasRef.current.width = processWidth;
        processCanvasRef.current.height = processHeight;
        processCtxRef.current = processCanvasRef.current.getContext('2d', { alpha: false, willReadFrequently: true });
        // Reset prevImageData when process canvas changes
        prevImageDataRef.current = null;
      }

      const processCanvas = processCanvasRef.current;
      const processCtx = processCtxRef.current;
      if (!processCtx) {
        animationRef.current = requestAnimationFrame(processFrame);
        return;
      }

      // Calculate draw parameters based on fit mode
      const videoAspect = videoWidth / videoHeight;
      const containerAspect = containerWidth / containerHeight;

      let srcX: number, srcY: number, srcWidth: number, srcHeight: number;
      let drawX: number, drawY: number, drawWidth: number, drawHeight: number;

      if (fitMode === 'contain') {
        // Contain: scale video to fit inside container, letterbox if needed
        if (videoAspect > containerAspect) {
          drawWidth = containerWidth;
          drawHeight = containerWidth / videoAspect;
        } else {
          drawHeight = containerHeight;
          drawWidth = containerHeight * videoAspect;
        }
        drawX = (containerWidth - drawWidth) / 2;
        drawY = (containerHeight - drawHeight) / 2;
        srcX = 0;
        srcY = 0;
        srcWidth = videoWidth;
        srcHeight = videoHeight;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, containerWidth, containerHeight);
      } else {
        // Cover: crop video from center to fill container
        if (videoAspect > containerAspect) {
          srcHeight = videoHeight;
          srcWidth = videoHeight * containerAspect;
          srcX = (videoWidth - srcWidth) / 2;
          srcY = 0;
        } else {
          srcWidth = videoWidth;
          srcHeight = videoWidth / containerAspect;
          srcX = 0;
          srcY = (videoHeight - srcHeight) / 2;
        }
        drawX = 0;
        drawY = 0;
        drawWidth = containerWidth;
        drawHeight = containerHeight;
      }

      // Draw cropped video frame to process canvas at reduced resolution
      processCtx.drawImage(
        videoElement,
        srcX, srcY, srcWidth, srcHeight,
        0, 0, processWidth, processHeight
      );

      // Apply temporal blend at reduced resolution
      const currentImageData = processCtx.getImageData(0, 0, processWidth, processHeight);
      
      if (prevImageDataRef.current && currentImageData.data.length === prevImageDataRef.current.data.length) {
        const current = currentImageData.data;
        const prev = prevImageDataRef.current.data;

        // Blend pixels: current = current * (1-blend) + prev * blend
        for (let i = 0; i < current.length; i += 4) {
          current[i] = current[i] * (1 - blendFactor) + prev[i] * blendFactor;
          current[i + 1] = current[i + 1] * (1 - blendFactor) + prev[i + 1] * blendFactor;
          current[i + 2] = current[i + 2] * (1 - blendFactor) + prev[i + 2] * blendFactor;
        }

        processCtx.putImageData(currentImageData, 0, 0);
      }

      prevImageDataRef.current = currentImageData;

      // Draw processed result to display canvas
      ctx.drawImage(processCanvas, drawX, drawY, drawWidth, drawHeight);

      animationRef.current = requestAnimationFrame(processFrame);
    };

    // Hide the original video and show processed canvas
    videoElement.style.opacity = '0';
    animationRef.current = requestAnimationFrame(processFrame);

    return cleanup;
  }, [videoElement, options.enabled]); // Only re-run when videoElement or enabled changes
}

/**
 * Create a lightweight temporal blend processor for LiveKit tracks.
 * Uses Insertable Streams API to process video frames before transmission.
 */
export function createLightweightTrackProcessor(blendFactor: number = 0.3) {
  let prevFrame: VideoFrame | null = null;

  return new TransformStream<VideoFrame, VideoFrame>({
    async transform(frame, controller) {
      try {
        // If no previous frame or blend is 0, pass through
        if (!prevFrame || blendFactor <= 0) {
          prevFrame?.close();
          prevFrame = frame;
          controller.enqueue(frame);
          return;
        }

        // Create output canvas
        const canvas = new OffscreenCanvas(frame.displayWidth, frame.displayHeight);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          controller.enqueue(frame);
          prevFrame?.close();
          prevFrame = frame;
          return;
        }

        // Draw current frame
        ctx.drawImage(frame, 0, 0);

        // Get pixel data
        const currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Create temp canvas for prev frame
        const tempCanvas = new OffscreenCanvas(prevFrame.displayWidth, prevFrame.displayHeight);
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(prevFrame, 0, 0);
          const prevImageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
          
          // Blend if sizes match
          if (currentImageData.data.length === prevImageData.data.length) {
            const current = currentImageData.data;
            const prev = prevImageData.data;

            for (let i = 0; i < current.length; i += 4) {
              current[i] = current[i] * (1 - blendFactor) + prev[i] * blendFactor;
              current[i + 1] = current[i + 1] * (1 - blendFactor) + prev[i + 1] * blendFactor;
              current[i + 2] = current[i + 2] * (1 - blendFactor) + prev[i + 2] * blendFactor;
            }

            ctx.putImageData(currentImageData, 0, 0);
          }
        }

        // Create new frame from canvas
        const bitmap = await createImageBitmap(canvas);
        let newFrame: VideoFrame | null = null;
        try {
          newFrame = new VideoFrame(bitmap, {
            timestamp: frame.timestamp,
            duration: frame.duration ?? undefined,
          });
          bitmap.close();
          prevFrame?.close();
          prevFrame = frame;
          controller.enqueue(newFrame);
        } catch {
          bitmap.close();
          prevFrame?.close();
          prevFrame = frame;
          controller.enqueue(frame);
        }
      } catch (e) {
        logger.warn('[LightweightFilter] Transform error:', e);
        controller.enqueue(frame);
      }
    },
    flush() {
      prevFrame?.close();
      prevFrame = null;
    }
  });
}

/**
 * Check if Insertable Streams API is supported
 */
export function isInsertableStreamsSupported(): boolean {
  return typeof MediaStreamTrackProcessor !== 'undefined' && 
         typeof MediaStreamTrackGenerator !== 'undefined';
}
