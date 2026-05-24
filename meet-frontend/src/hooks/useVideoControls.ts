/**
 * useVideoControls - Camera device management and video controls
 *
 * Extracted from ControlBar to reduce component complexity.
 * Handles camera enumeration, toggle, and switching.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { LocalParticipant, Room } from 'livekit-client';
import type { QualityModeName } from '../config/meetingRoomConfig';
import type { GridAspectRatio } from '../store/roomStore';
import { buildCameraCaptureOptions, isAudioOnlyMode, meetingRoomConfig } from '../config/meetingRoomConfig';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useVideoControls(
  localParticipant: LocalParticipant | undefined,
  room: Room | undefined,
  qualityMode: QualityModeName,
  gridAspectRatio: GridAspectRatio,
) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState('');

  // Device enumeration for video
  useEffect(() => {
    if (!room) return;

    const refreshDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((device) => device.kind === 'videoinput'));
        setActiveCameraId(room.getActiveDevice('videoinput') || '');
      } catch (error) {
        logger.error('Failed to refresh video devices:', error);
      }
    };

    const handleActiveDeviceChanged = (kind: string, deviceId: string) => {
      if (kind === 'videoinput') setActiveCameraId(deviceId);
    };

    void refreshDevices();
    navigator.mediaDevices.addEventListener?.('devicechange', refreshDevices);
    room.on('activeDeviceChanged', handleActiveDeviceChanged);

    return () => {
      navigator.mediaDevices.removeEventListener?.('devicechange', refreshDevices);
      room.off('activeDeviceChanged', handleActiveDeviceChanged);
    };
  }, [room]);

  const isTogglingCamera = useRef(false);

  const toggleCamera = useCallback(async () => {
    if (isTogglingCamera.current) return;
    if (!localParticipant) return;
    isTogglingCamera.current = true;
    try {
      if (isAudioOnlyMode(qualityMode)) {
        toast.error(meetingRoomConfig.feedback.audioOnlyMessage);
        return;
      }
      const currentlyEnabled = localParticipant.isCameraEnabled;
      await localParticipant.setCameraEnabled(
        !currentlyEnabled,
        !currentlyEnabled ? buildCameraCaptureOptions(activeCameraId || undefined, qualityMode, gridAspectRatio) : undefined,
      );
    } catch (error) {
      logger.error('Failed to toggle camera:', error);
      toast.error('Failed to toggle camera');
    } finally {
      isTogglingCamera.current = false;
    }
  }, [localParticipant, qualityMode, gridAspectRatio, activeCameraId]);

  const switchCamera = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await room.switchActiveDevice('videoinput', deviceId || 'default');
      setActiveCameraId(deviceId);
    } catch (error) {
      logger.error('Failed to switch camera:', error);
      toast.error('Failed to switch camera');
    }
  }, [room]);

  return {
    cameras,
    activeCameraId,
    toggleCamera,
    switchCamera,
  };
}
