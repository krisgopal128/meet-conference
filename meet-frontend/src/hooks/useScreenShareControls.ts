/**
 * useScreenShareControls - Screen share toggle logic
 *
 * Extracted from ControlBar to reduce component complexity.
 */

import { useCallback } from 'react';
import type { LocalParticipant } from 'livekit-client';
import type { QualityModeName, ScreenShareModeName } from '../config/meetingRoomConfig';
import { getScreenShareOptions } from '../config/meetingRoomConfig';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useScreenShareControls(
  localParticipant: LocalParticipant | undefined,
  qualityMode: QualityModeName,
  screenShareMode: ScreenShareModeName,
) {
  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    try {
      const currentlyEnabled = localParticipant.isScreenShareEnabled;
      const options = getScreenShareOptions(qualityMode, screenShareMode);
      await localParticipant.setScreenShareEnabled(
        !currentlyEnabled,
        currentlyEnabled ? { audio: false } : { audio: options.audio },
        currentlyEnabled ? undefined : { screenShareEncoding: options.encoding },
      );
    } catch (error) {
      logger.error('Screen share error:', error);
      toast.error('Screen share was cancelled or not supported.');
    }
  }, [localParticipant, qualityMode, screenShareMode]);

  return { toggleScreenShare };
}
