import { useState, useEffect, useMemo, useRef } from 'react';
import { useRoomContext } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { meetingRoomConfig } from '../config/meetingRoomConfig';

export interface CallSizeConfig {
  participantCount: number;
  isLargeCall: boolean;
  maxResolution: {
    width: number;
    height: number;
  };
  simulcastLayers: number; // 2, 3, or 4
  maxFramerate: number;
  maxBitrate: number;
}

const LARGE_CALL_THRESHOLD = 8;
const VERY_LARGE_CALL_THRESHOLD = 16;

export function useCallSizeConfig(): CallSizeConfig {
  const room = useRoomContext();
  const [participantCount, setParticipantCount] = useState(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!room) return;

    const updateCount = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        // Count all participants (remote + local)
        const remoteCount = room.remoteParticipants.size;
        const localCount = 1; // Local participant
        setParticipantCount(remoteCount + localCount);
      }, 300);
    };

    // Initial count
    updateCount();

    // Listen for participant changes
    room.on(RoomEvent.ParticipantConnected, updateCount);
    room.on(RoomEvent.ParticipantDisconnected, updateCount);

    return () => {
      room.off(RoomEvent.ParticipantConnected, updateCount);
      room.off(RoomEvent.ParticipantDisconnected, updateCount);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [room]);

  const config = useMemo((): CallSizeConfig => {
    const isLargeCall = participantCount > LARGE_CALL_THRESHOLD;
    const isVeryLargeCall = participantCount > VERY_LARGE_CALL_THRESHOLD;

    if (isVeryLargeCall) {
      // Very large call: 720p, 2 simulcast layers, 24fps
      return {
        participantCount,
        isLargeCall: true,
        maxResolution: { width: 1280, height: 720 },
        simulcastLayers: 2,
        maxFramerate: 24,
        maxBitrate: 1000000, // 1 Mbps
      };
    }

    if (isLargeCall) {
      // Large call: 720p, 3 simulcast layers, 24fps
      return {
        participantCount,
        isLargeCall: true,
        maxResolution: { width: 1280, height: 720 },
        simulcastLayers: 3,
        maxFramerate: 24,
        maxBitrate: 1500000, // 1.5 Mbps
      };
    }

    // Small call: 1080p, 4 simulcast layers, 30fps
    return {
      participantCount,
      isLargeCall: false,
      maxResolution: { width: 1920, height: 1080 },
      simulcastLayers: 4,
      maxFramerate: 30,
      maxBitrate: 3000000, // 3 Mbps
    };
  }, [participantCount]);

  return config;
}

export function getSimulcastLayersForCount(layers: number) {
  const allLayers = meetingRoomConfig.media.simulcastLayers;
  
  switch (layers) {
    case 2:
      // Low and High only
      return {
        low: allLayers.low,
        high: allLayers.high,
      };
    case 3:
      // Low, Medium, High
      return {
        low: allLayers.low,
        medium: allLayers.medium,
        high: allLayers.high,
      };
    case 4:
    default:
      // All layers including Ultra
      return allLayers;
  }
}
