/**
 * useSpeakerManager - Handles speaker device switching and volume control
 * 
 * Extracted from RoomPage.RoomContent to reduce component complexity.
 */

import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';

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
      console.error('[RoomPage] Failed to switch speaker device:', error);
    });
  }, [room, selectedSpeaker]);

  useEffect(() => {
    const volume = Math.max(0, Math.min(1, (speakerLevel ?? 100) / 100));

    document.querySelectorAll<HTMLMediaElement>('audio, video').forEach((element) => {
      if (!element.muted) {
        element.volume = volume;
      }
    });
  }, [speakerLevel]);
}
