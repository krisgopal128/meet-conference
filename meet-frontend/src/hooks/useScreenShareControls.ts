/**
 * useScreenShareControls - Screen share toggle logic
 *
 * Extracted from ControlBar to reduce component complexity.
 */

import { useCallback, useRef } from 'react';
import type { LocalParticipant } from 'livekit-client';
import type { QualityModeName, ScreenShareModeName } from '../config/meetingRoomConfig';
import { getScreenShareOptions } from '../config/meetingRoomConfig';
import { withOperationTimeout } from '../utils/asyncTimeout';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useScreenShareControls(
  localParticipant: LocalParticipant | undefined,
  qualityMode: QualityModeName,
  screenShareMode: ScreenShareModeName,
) {
  const pendingTargetRef = useRef<boolean | null>(null);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;

    // Capability check BEFORE calling LiveKit. getDisplayMedia is absent in
    // in-app WebViews (WhatsApp, Telegram, Facebook) and on iOS Safari.
    if (!navigator.mediaDevices?.getDisplayMedia) {
      const isInWebView = /; wv\)/.test(navigator.userAgent);
      toast.error(
        isInWebView
          ? 'Screen share needs Chrome. Tap the ⋮ menu → "Open in Chrome" and rejoin.'
          : 'Screen share is not supported on this browser. Try Chrome or Firefox.',
        { duration: 6000 },
      );
      return;
    }

    // If a toggle is in progress, queue a reversal of the pending target
    if (pendingTargetRef.current !== null) {
      pendingTargetRef.current = !pendingTargetRef.current;
      return;
    }

    pendingTargetRef.current = !localParticipant.isScreenShareEnabled;

    try {
      let lastApplied: boolean | null = null;
      while (lastApplied !== pendingTargetRef.current) {
        lastApplied = pendingTargetRef.current;
        const options = getScreenShareOptions(qualityMode, screenShareMode);

        const captureOpts = lastApplied
          ? {
              audio: options.audio,
              resolution: options.resolution,
              contentHint: options.contentHint,
              surfaceSwitching: options.surfaceSwitching,
              systemAudio: options.systemAudio,
              selfBrowserSurface: options.selfBrowserSurface,
            }
          : { audio: false };

        const publishOpts = lastApplied
          ? { screenShareEncoding: options.encoding }
          : undefined;

        try {
          await withOperationTimeout(
            localParticipant.setScreenShareEnabled(lastApplied, captureOpts, publishOpts),
            'SCREEN_SHARE',
            'Toggle screen share',
          );
        } catch (e) {
          // If enabling with audio failed for a non-cancellation reason, retry
          // once without audio — some browsers reject getDisplayMedia when tab
          // audio capture isn't supported even though the video would work.
          if (lastApplied && options.audio && !(e instanceof DOMException && e.name === 'NotAllowedError')) {
            logger.warn('Screen share with audio failed, retrying without audio:', e);
            await withOperationTimeout(
              localParticipant.setScreenShareEnabled(
                true,
                { ...captureOpts, audio: false },
                publishOpts,
              ),
              'SCREEN_SHARE',
              'Toggle screen share (no audio)',
            );
          } else {
            throw e;
          }
        }
      }
    } catch (error) {
      // User cancelled the picker — silent, not an error
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      logger.error('Screen share error:', error);
      toast.error('Screen share was cancelled or not supported.');
    } finally {
      pendingTargetRef.current = null;
    }
  }, [localParticipant, qualityMode, screenShareMode]);

  return { toggleScreenShare };
}
