/**
 * useCappedCoverScale — smart video cover that caps crop at 10% max.
 *
 * Uses object-fit: contain + transform: scale() so the video fills the
 * container without over-cropping on aspect-ratio mismatch.
 *
 * When ratios match  → scale 1.0 (perfect fill, no crop)
 * When ratios differ → scale up to 1.111 (max 10% crop, 90% video visible)
 *
 * Used by both PreJoinPage and ParticipantTile so the camera feed looks
 * identical before joining and inside the meeting.
 */

import { useState, useEffect } from 'react';

const MAX_CROP_FRACTION = 0.10;
const MAX_COVER_SCALE = 1 / (1 - MAX_CROP_FRACTION); // ≈ 1.111

export function useCappedCoverScale(
  containerRef: React.RefObject<HTMLDivElement | null>,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  fitMode: string,
  active: boolean,
): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!active || fitMode !== 'cover') {
      setScale(1);
      return;
    }

    const container = containerRef.current;
    const video = videoRef.current;
    if (!container || !video) return;

    const compute = () => {
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      if (cw === 0 || ch === 0 || vw === 0 || vh === 0) return;

      const containerRatio = cw / ch;
      const videoRatio = vw / vh;
      const ratio = Math.max(containerRatio, videoRatio) / Math.min(containerRatio, videoRatio);

      setScale(Math.min(ratio, MAX_COVER_SCALE));
    };

    compute();

    // ResizeObserver is unavailable in jsdom and some legacy browsers —
    // fall back to a window resize listener so the hook never crashes.
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(compute);
      ro.observe(container);
    } else {
      window.addEventListener('resize', compute);
    }

    const handleVideoEvent = () => compute();
    video.addEventListener('loadedmetadata', handleVideoEvent);
    video.addEventListener('resize', handleVideoEvent);

    return () => {
      if (ro) {
        ro.disconnect();
      } else {
        window.removeEventListener('resize', compute);
      }
      video.removeEventListener('loadedmetadata', handleVideoEvent);
      video.removeEventListener('resize', handleVideoEvent);
    };
  }, [containerRef, videoRef, fitMode, active]);

  return scale;
}

export { MAX_COVER_SCALE };
