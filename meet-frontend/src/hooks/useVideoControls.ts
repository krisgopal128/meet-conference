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
import { usePrejoinCameraId } from '../store/roomStore';
import { withOperationTimeout } from '../utils/asyncTimeout';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useVideoControls(
  localParticipant: LocalParticipant | undefined,
  room: Room | undefined,
  qualityMode: QualityModeName,
  gridAspectRatio: GridAspectRatio,
) {
  const prejoinCameraId = usePrejoinCameraId();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState('');

  // Device enumeration for video
  useEffect(() => {
    if (!room) return;

    const refreshDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter((device) => device.kind === 'videoinput'));
        const currentDevice = room.getActiveDevice('videoinput');
        setActiveCameraId(currentDevice || prejoinCameraId || '');
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
  }, [room, prejoinCameraId]);

  const pendingTargetRef = useRef<boolean | null>(null);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant) return;

    if (isAudioOnlyMode(qualityMode)) {
      toast.error(meetingRoomConfig.feedback.audioOnlyMessage);
      return;
    }

    // If a toggle is in progress, queue a reversal of the pending target
    if (pendingTargetRef.current !== null) {
      pendingTargetRef.current = !pendingTargetRef.current;
      return;
    }

    pendingTargetRef.current = !localParticipant.isCameraEnabled;

    try {
      let lastApplied: boolean | null = null;
      while (lastApplied !== pendingTargetRef.current) {
        lastApplied = pendingTargetRef.current;
        await withOperationTimeout(
          localParticipant.setCameraEnabled(
            lastApplied,
            lastApplied ? buildCameraCaptureOptions(activeCameraId || undefined, qualityMode, gridAspectRatio) : undefined,
          ),
          'MEDIA_TOGGLE',
          'Toggle camera',
        );
      }
    } catch (error) {
      logger.error('Failed to toggle camera:', error);
      toast.error('Failed to toggle camera');
    } finally {
      pendingTargetRef.current = null;
    }
  }, [localParticipant, qualityMode, gridAspectRatio, activeCameraId]);

  const switchCamera = useCallback(async (deviceId: string) => {
    if (!room) return;
    try {
      await withOperationTimeout(
        room.switchActiveDevice('videoinput', deviceId || 'default'),
        'DEVICE_SWITCH',
        'Switch camera device'
      );
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
