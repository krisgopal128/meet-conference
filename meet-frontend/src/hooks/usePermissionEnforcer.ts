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

  const canPublishSources = localParticipant.permissions?.canPublishSources;
  const canPublishSourcesKey = canPublishSources ? canPublishSources.join(',') : '';
  const cameraEnabled = localParticipant.isCameraEnabled;
  const micEnabled = localParticipant.isMicrophoneEnabled;
  const screenShareEnabled = localParticipant.isScreenShareEnabled;
  const enforcementKey = `${canPublishSourcesKey}|${cameraEnabled ? 1 : 0}|${micEnabled ? 1 : 0}|${screenShareEnabled ? 1 : 0}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enforcementKey,
  ]);
}
