/**
 * useLeaveMeeting - Leave/end meeting logic
 *
 * Extracted from ControlBar to reduce component complexity.
 * Handles leaving a room or ending a meeting for all participants.
 */

import { useCallback } from 'react';
import type { LocalParticipant, Room } from 'livekit-client';
import type { NavigateFunction } from 'react-router-dom';
import { roomsApi } from '../services/api';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useLeaveMeeting(
  room: Room | undefined,
  localParticipant: LocalParticipant | undefined,
  navigate: NavigateFunction,
  reset: () => void,
) {
  const leaveRoom = useCallback(async () => {
    if (!room || !localParticipant) return;

    const roomName = room.name;

    try {
      if (localParticipant.isScreenShareEnabled) await localParticipant.setScreenShareEnabled(false);
      if (localParticipant.isCameraEnabled) await localParticipant.setCameraEnabled(false);
      if (localParticipant.isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      logger.error('Failed to stop local media before disconnect:', error);
    } finally {
      await room.disconnect();
      reset();
      navigate('/thank-you', { state: { roomName } });
    }
  }, [room, localParticipant, navigate, reset]);

  const endMeeting = useCallback(async () => {
    if (!room || !localParticipant) return;

    const roomName = room.name;

    // Notify all participants that meeting is ending
    try {
      const message = new TextEncoder().encode(JSON.stringify({
        type: 'meeting_ended',
        message: 'Host ended the meeting',
        reason: 'host_left',
      }));
      await room.localParticipant.publishData(message, { reliable: true, topic: 'meeting_ended' });
    } catch (error) {
      logger.error('Failed to send meeting_ended message:', error);
      toast.error('Failed to send meeting_ended message');
    }

    // End meeting on backend
    try {
      await roomsApi.endMeeting(roomName);
    } catch (error) {
      logger.error('Failed to end meeting on backend:', error);
      toast.error('Failed to end meeting');
    }

    // Stop local tracks
    try {
      if (localParticipant.isScreenShareEnabled) await localParticipant.setScreenShareEnabled(false);
      if (localParticipant.isCameraEnabled) await localParticipant.setCameraEnabled(false);
      if (localParticipant.isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false);
    } catch (error) {
      logger.error('Failed to stop local media before disconnect:', error);
    } finally {
      await room.disconnect();
      reset();
      navigate('/thank-you', { state: { roomName } });
    }
  }, [room, localParticipant, navigate, reset]);

  return { leaveRoom, endMeeting };
}
