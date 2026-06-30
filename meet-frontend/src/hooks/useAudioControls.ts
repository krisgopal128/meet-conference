/**
 * useAudioControls - Audio device management and mic/speaker controls
 *
 * Extracted from ControlBar to reduce component complexity.
 * Handles mic/speaker enumeration, toggle, and switching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LocalParticipant, Room } from 'livekit-client';
import { usePrejoinMicId } from '../store/roomStore';
import { getMediaErrorMessage } from '../utils/mediaErrors';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useAudioControls(
  localParticipant: LocalParticipant | undefined,
  room: Room | undefined,
) {
  const prejoinMicId = usePrejoinMicId();
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([]);
  const [activeMicId, setActiveMicId] = useState('');
  const [activeSpeakerId, setActiveSpeakerId] = useState('');

  // Device enumeration for audio
  useEffect(() => {
    if (!room) return;
    if (!navigator.mediaDevices?.enumerateDevices) return;

    const refreshDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setMics(devices.filter((device) => device.kind === 'audioinput'));
        setSpeakers(devices.filter((device) => device.kind === 'audiooutput'));
        const currentMic = room.getActiveDevice('audioinput');
        setActiveMicId(currentMic || prejoinMicId || '');
        setActiveSpeakerId(room.getActiveDevice('audiooutput') || '');
      } catch (error) {
        logger.error('Failed to refresh audio devices:', error);
      }
    };

    const handleActiveDeviceChanged = (kind: string, deviceId: string) => {
      if (kind === 'audioinput') setActiveMicId(deviceId);
      if (kind === 'audiooutput') setActiveSpeakerId(deviceId);
    };

    void refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    room.on('activeDeviceChanged', handleActiveDeviceChanged);

    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
      room.off('activeDeviceChanged', handleActiveDeviceChanged);
    };
  }, [room, prejoinMicId]);

  const pendingTargetRef = useRef<boolean | null>(null);

  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;

    // If a toggle is in progress, queue a reversal of the pending target
    if (pendingTargetRef.current !== null) {
      pendingTargetRef.current = !pendingTargetRef.current;
      return;
    }

    pendingTargetRef.current = !localParticipant.isMicrophoneEnabled;

    try {
      let lastApplied: boolean | null = null;
      while (lastApplied !== pendingTargetRef.current) {
        lastApplied = pendingTargetRef.current;
        await localParticipant.setMicrophoneEnabled(
          lastApplied,
          // Pass only deviceId — LiveKit merges this on top of the room's
          // audioCaptureDefaults (which already has the user's prejoin
          // noiseSuppression/echoCancellation/micLevel settings).
          lastApplied ? { deviceId: activeMicId || undefined } : undefined,
        );
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      logger.error('Failed to toggle microphone:', error);
      toast.error(getMediaErrorMessage(error, 'Microphone toggle'));
    } finally {
      pendingTargetRef.current = null;
    }
  }, [localParticipant, activeMicId]);

  const switchMic = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice('audioinput', deviceId || 'default');
      setActiveMicId(deviceId);
    } catch (error) {
      logger.error('Failed to switch microphone:', error);
      toast.error(getMediaErrorMessage(error, 'Microphone switch'));
    }
  }, [room]);

  const switchSpeaker = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice('audiooutput', deviceId || 'default');
      setActiveSpeakerId(deviceId);
    } catch (error) {
      logger.error('Failed to switch speaker:', error);
      toast.error(getMediaErrorMessage(error, 'Speaker switch'));
    }
  }, [room]);

  return {
    mics,
    speakers,
    activeMicId,
    activeSpeakerId,
    toggleMic,
    switchMic,
    switchSpeaker,
  };
}
