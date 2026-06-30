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
import { isAudioOnlyMode, meetingRoomConfig } from '../config/meetingRoomConfig';
import { usePrejoinCameraId } from '../store/roomStore';
import { withOperationTimeout } from '../utils/asyncTimeout';
import { getMediaErrorMessage } from '../utils/mediaErrors';
import toast from 'react-hot-toast';
import logger from '../utils/logger';

export function useVideoControls(
  localParticipant: LocalParticipant | undefined,
  room: Room | undefined,
  qualityMode: QualityModeName,
  _gridAspectRatio: GridAspectRatio,
) {
  const prejoinCameraId = usePrejoinCameraId();
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [activeCameraId, setActiveCameraId] = useState('');

  // Device enumeration for video
  useEffect(() => {
    if (!room) return;
    if (!navigator.mediaDevices?.enumerateDevices) return;

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
        // Pass only deviceId — LiveKit merges this on top of the room's
        // videoCaptureDefaults (which already has the correct quality mode
        // resolution, hardwareCaps, and aspect ratio from room setup).
        // Quality changes are handled by the adaptive simulcast system.
        try {
          await withOperationTimeout(
            localParticipant.setCameraEnabled(
              lastApplied,
              lastApplied ? { deviceId: activeCameraId || undefined } : undefined,
            ),
            'MEDIA_TOGGLE',
            'Toggle camera',
          );
        } catch (e) {
          // Graceful degradation: if enabling with specific constraints fails
          // for a non-permission reason, retry with bare-minimum constraints.
          if (lastApplied && !(e instanceof DOMException && e.name === 'NotAllowedError')) {
            logger.warn('Camera enable failed, retrying with minimal constraints:', e);
            await withOperationTimeout(
              localParticipant.setCameraEnabled(true, { deviceId: activeCameraId || undefined }),
              'MEDIA_TOGGLE',
              'Toggle camera (minimal)',
            );
          } else {
            throw e;
          }
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') return;
      logger.error('Failed to toggle camera:', error);
      toast.error(getMediaErrorMessage(error, 'Camera toggle'));
    } finally {
      pendingTargetRef.current = null;
    }
  }, [localParticipant, qualityMode, activeCameraId]);

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
      toast.error(getMediaErrorMessage(error, 'Camera switch'));
    }
  }, [room]);

  return {
    cameras,
    activeCameraId,
    toggleCamera,
    switchCamera,
  };
}
