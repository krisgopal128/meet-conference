/**
 * usePermissionEnforcer - Enforces camera/mic/screenshare permissions
 * 
 * Extracted from RoomPage.RoomContent to reduce component complexity.
 */

import { useEffect } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { shouldDisableSource } from '../pages/RoomPage';
import logger from '../utils/logger';

export function usePermissionEnforcer() {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    const permission = localParticipant.permissions;
    if (!permission) return;

    if (shouldDisableSource(localParticipant, 'camera')) {
      void localParticipant.setCameraEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to enforce camera disable from permissions:', error);
      });
    }

    if (shouldDisableSource(localParticipant, 'microphone')) {
      void localParticipant.setMicrophoneEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to enforce microphone mute from permissions:', error);
      });
    }

    if (shouldDisableSource(localParticipant, 'screen_share')) {
      void localParticipant.setScreenShareEnabled(false).catch((error) => {
        logger.error('[RoomPage] Failed to enforce screen share disable from permissions:', error);
      });
    }
  }, [
    localParticipant,
    localParticipant.permissions,
    localParticipant.permissions?.canPublishSources,
    localParticipant.isCameraEnabled,
    localParticipant.isMicrophoneEnabled,
    localParticipant.isScreenShareEnabled,
  ]);
}
