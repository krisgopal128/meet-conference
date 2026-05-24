/**
 * useMeetingActions - Leave/End meeting logic
 *
 * Extracted from ControlBar to reduce component complexity.
 */

import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Room } from 'livekit-client';
import { useLocalParticipant, useMaybeRoomContext } from '@livekit/components-react';
import { roomsApi } from '../services/api';

// Module-level registry for whiteboard force-save callbacks
// Registered by WhiteboardLayout/WhiteboardPanel via useWhiteboardAutoSave
const whiteboardSaveFns = new Set<() => Promise<void>>();

export function registerWhiteboardSave(fn: () => Promise<void>): () => void {
  whiteboardSaveFns.add(fn);
  return () => { whiteboardSaveFns.delete(fn); };
}

async function saveAllWhiteboards() {
  const saves = Array.from(whiteboardSaveFns).map(fn => fn().catch(() => {}));
  await Promise.allSettled(saves);
}
import { useConnectionActions, useRoomStore } from '../store/roomStore';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

/** Runtime property on Room not in TS declarations */
type RoomWithConnection = Room & { connectedAt?: Date | string };

function getDuration(room: Room): number {
  const connectedAt = (room as RoomWithConnection).connectedAt || new Date();
  return Math.round((Date.now() - new Date(connectedAt).getTime()) / 60000);
}

async function stopLocalTracks(localParticipant: { isScreenShareEnabled: boolean; isCameraEnabled: boolean; isMicrophoneEnabled: boolean; setScreenShareEnabled: (v: boolean) => Promise<unknown>; setCameraEnabled: (v: boolean) => Promise<unknown>; setMicrophoneEnabled: (v: boolean) => Promise<unknown> }) {
  try {
    if (localParticipant.isScreenShareEnabled) await localParticipant.setScreenShareEnabled(false);
    if (localParticipant.isCameraEnabled) await localParticipant.setCameraEnabled(false);
    if (localParticipant.isMicrophoneEnabled) await localParticipant.setMicrophoneEnabled(false);
  } catch (error) {
    logger.error('Failed to stop local media before disconnect:', error);
  }
}

export function useMeetingActions() {
  const navigate = useNavigate();
  const { localParticipant } = useLocalParticipant();
  const room = useMaybeRoomContext();
  const { reset } = useConnectionActions();

  const leaveRoom = useCallback(async () => {
    if (!room || !localParticipant) return;

    const roomName = room.name;
    const duration = getDuration(room);

    // Save whiteboard before leaving (best-effort)
    await saveAllWhiteboards();

    // Stop recording if active
    const storeState = useRoomStore.getState();
    if (storeState.isRecording && storeState.egressId) {
      try { await roomsApi.stopRecording(storeState.egressId); } catch {}
    }

    try {
      await stopLocalTracks(localParticipant);
    } catch (e) {
      // Best-effort — tracks may already be stopped
    }
    try {
      await room.disconnect();
    } catch (e) {
      // Best-effort — may already be disconnected
    }
    reset();
    navigate('/thank-you', { state: { roomName, duration: duration > 0 ? duration : undefined } });
  }, [room, localParticipant, navigate, reset]);

  const endMeeting = useCallback(async () => {
    if (!room || !localParticipant) return;

    const roomName = room.name;
    const duration = getDuration(room);

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

    // Save whiteboard before disconnecting (best-effort)
    await saveAllWhiteboards();

    try {
      await stopLocalTracks(localParticipant);
    } catch (e) {
      // Best-effort
    }
    await room.disconnect();
    reset();
    navigate('/thank-you', { state: { roomName, duration: duration > 0 ? duration : undefined } });
  }, [room, localParticipant, navigate, reset]);

  const hasOtherParticipants = room ? room.remoteParticipants.size > 0 : false;

  return { leaveRoom, endMeeting, hasOtherParticipants };
}
