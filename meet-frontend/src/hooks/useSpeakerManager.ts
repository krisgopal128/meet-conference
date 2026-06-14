/**
 * useSpeakerManager - Handles speaker device switching and volume control
 * 
 * Extracted from RoomPage.RoomContent to reduce component complexity.
 */

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import logger from '../utils/logger';

interface UseSpeakerManagerProps {
  selectedSpeaker?: string;
  speakerLevel?: number;
}

export function useSpeakerManager({ selectedSpeaker, speakerLevel }: UseSpeakerManagerProps) {
  const room = useRoomContext();

  useEffect(() => {
    if (!room) return;

    const deviceId = selectedSpeaker || 'default';
    void room.switchActiveDevice('audiooutput', deviceId).catch((error) => {
      logger.error('[RoomPage] Failed to switch speaker device:', error);
    });
  }, [room, selectedSpeaker]);

  useEffect(() => {
    if (!room) return;
    const volume = Math.max(0, Math.min(1, (speakerLevel ?? 100) / 100));
    room.remoteParticipants.forEach((participant) => {
      participant.audioTrackPublications.forEach((pub) => {
        if (pub.track) {
          (pub.track as any).setVolume?.(volume);
        }
      });
    });
  }, [room, speakerLevel]);
}
