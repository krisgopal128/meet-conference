/**
 * useSettingsSync - Sync video settings across all participants
 */

import { useCallback } from 'react';
import { useLocalParticipant, useRoomContext } from '@livekit/components-react';
import logger from '../utils/logger';

interface SettingsSyncMessage {
  type: 'settings_sync';
  setting: 'videoFitMode';
  value: 'cover' | 'contain';
  senderIdentity: string;
}

export function useVideoFitModeSync() {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const broadcastVideoFitMode = useCallback(
    (mode: 'cover' | 'contain') => {
      const message: SettingsSyncMessage = {
        type: 'settings_sync',
        setting: 'videoFitMode',
        value: mode,
        senderIdentity: localParticipant.identity,
      };

      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(message));

      room.localParticipant.publishData(data, { reliable: true });
      logger.info('[useSettingsSync] Broadcasted videoFitMode:', mode);
    },
    [room, localParticipant]
  );

  return {
    broadcastVideoFitMode,
  };
}
