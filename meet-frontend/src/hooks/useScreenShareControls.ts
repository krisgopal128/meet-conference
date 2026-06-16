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
        await withOperationTimeout(
          localParticipant.setScreenShareEnabled(
            lastApplied,
            lastApplied ? { audio: options.audio } : { audio: false },
            lastApplied ? { screenShareEncoding: options.encoding } : undefined,
          ),
          'SCREEN_SHARE',
          'Toggle screen share',
        );
      }
    } catch (error) {
      logger.error('Screen share error:', error);
      toast.error('Screen share was cancelled or not supported.');
    } finally {
      pendingTargetRef.current = null;
    }
  }, [localParticipant, qualityMode, screenShareMode]);

  return { toggleScreenShare };
}
