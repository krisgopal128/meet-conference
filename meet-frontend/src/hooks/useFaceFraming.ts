/**
 * useFaceFraming — AI face detection for smart video framing.
 *
 * Uses MediaPipe BlazeFace (short-range) to detect faces in the video
 * and computes an optimal `object-position` CSS value that keeps the
 * face centered. Works with both object-fit: cover (smart crop) and
 * object-fit: contain (centered letterbox).
 *
 * Key design decisions:
 * - Lazy-loads MediaPipe only when video is visible + playing
 * - Runs detection at 500ms intervals (not per-frame) to save CPU
 * - Graceful degradation: if detection fails, returns '50% 50%' (center)
 * - Smooth interpolation toward the target position (no jitter)
 * - Auto-disables when tab is hidden (Page Visibility API)
 * - Single shared FaceDetector instance across all tiles
 */

import { useEffect, useRef, useState, useCallback } from 'react';

const DETECTION_INTERVAL_MS = 500;
const SMOOTHING_FACTOR = 0.15;
const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

// Module-level shared detector — all tiles share one instance
type FaceDetectorType = {
  detect: (image: HTMLVideoElement | HTMLImageElement) => unknown;
  close?: () => void;
};

let _sharedDetector: FaceDetectorType | null = null;
let _loadingPromise: Promise<FaceDetectorType | null> | null = null;
let _loadFailedCount = 0;
const MAX_LOAD_RETRIES = 3;

async function getFaceDetector(): Promise<FaceDetectorType | null> {
  if (_sharedDetector) return _sharedDetector;
  if (_loadFailedCount >= MAX_LOAD_RETRIES) return null;
  if (_loadingPromise) return _loadingPromise;

  _loadingPromise = (async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
      const detector = await FaceDetector.createFromModelPath(vision, MODEL_URL);
      _sharedDetector = {
        detect: (img) => detector.detect(img),
        close: () => { try { detector.close(); } catch { /* noop */ } },
      };
      return _sharedDetector;
    } catch {
      _loadFailedCount++;
      return null;
    } finally {
      _loadingPromise = null;
    }
  })();

  return _loadingPromise;
}

interface TargetPosition {
  x: number; // 0-1, normalized face center X
  y: number; // 0-1, normalized face center Y
}

export function useFaceFraming(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  enabled: boolean,
  mirrored: boolean,
): string {
  const [objectPosition, setObjectPosition] = useState('50% 50%');
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const smoothedRef = useRef<TargetPosition>({ x: 0.5, y: 0.5 });
  const mountedRef = useRef(true);
  const mirroredRef = useRef(mirrored);
  mirroredRef.current = mirrored;

  const computePosition = useCallback(() => {
    if (!mountedRef.current) return;

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(computePosition);
      return;
    }

    // Skip detection when tab is hidden — resume when visible
    if (document.hidden) {
      rafRef.current = requestAnimationFrame(computePosition);
      return;
    }

    const now = performance.now();
    if (now - lastDetectRef.current < DETECTION_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(computePosition);
      return;
    }
    lastDetectRef.current = now;

    getFaceDetector().then((detector) => {
      if (!mountedRef.current || !detector) {
        rafRef.current = requestAnimationFrame(computePosition);
        return;
      }

      try {
        const result = detector.detect(video) as {
          detections: Array<{
            boundingBox: { originX: number; originY: number; width: number; height: number };
          }>;
        };
        const detections = result.detections || [];

        if (detections.length === 0) {
          // No face — gently drift back to center
          smoothedRef.current.x += (0.5 - smoothedRef.current.x) * SMOOTHING_FACTOR;
          smoothedRef.current.y += (0.5 - smoothedRef.current.y) * SMOOTHING_FACTOR;
        } else {
          // Use the largest face (most prominent)
          const best = detections.reduce((max, d) => {
            const area = d.boundingBox.width * d.boundingBox.height;
            const maxArea = max.boundingBox.width * max.boundingBox.height;
            return area > maxArea ? d : max;
          });

          // Face center in normalized coordinates [0, 1]
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          let faceCx = (best.boundingBox.originX + best.boundingBox.width / 2) / vw;
          const faceCy = (best.boundingBox.originY + best.boundingBox.height / 2) / vh;

          // If video is displayed mirrored (local participant), flip the X axis
          // so object-position follows the face as the user sees it
          if (mirroredRef.current) {
            faceCx = 1 - faceCx;
          }

          // Clamp to valid range (avoid extreme edges)
          const targetX = Math.max(0.1, Math.min(0.9, faceCx));
          const targetY = Math.max(0.1, Math.min(0.9, faceCy));

          // Smooth interpolation toward target
          smoothedRef.current.x += (targetX - smoothedRef.current.x) * SMOOTHING_FACTOR;
          smoothedRef.current.y += (targetY - smoothedRef.current.y) * SMOOTHING_FACTOR;
        }

        // Only update state if position actually changed (avoid needless re-renders)
        const cssX = Math.round(smoothedRef.current.x * 100);
        const cssY = Math.round(smoothedRef.current.y * 100);
        const newPos = `${cssX}% ${cssY}%`;
        setObjectPosition((prev) => (prev !== newPos ? newPos : prev));
      } catch {
        // Detection error — silently ignore, keep previous position
      }

      if (mountedRef.current) {
        rafRef.current = requestAnimationFrame(computePosition);
      }
    });
  }, [videoRef]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setObjectPosition('50% 50%');
      smoothedRef.current = { x: 0.5, y: 0.5 };
      return;
    }

    rafRef.current = requestAnimationFrame(computePosition);

    // Handle visibility change — resume detection immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden && mountedRef.current && !rafRef.current) {
        lastDetectRef.current = 0; // Force immediate detection on resume
        rafRef.current = requestAnimationFrame(computePosition);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, computePosition]);

  return objectPosition;
}
