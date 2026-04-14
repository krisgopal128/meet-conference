/**
 * useMediaSync - Handles initial media state synchronization
 * 
 * Extracted from RoomPage.RoomContent to reduce component complexity.
 */

import { useEffect, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import {
  buildCameraCaptureOptions,
  buildAudioCaptureOptions,
} from '../config/meetingRoomConfig';
import type { QualityModeName, CameraHardwareCaps } from '../config/meetingRoomConfig';
import logger from '../utils/logger';

interface UseMediaSyncProps {
  videoEnabled: boolean;
  audioEnabled: boolean;
  selectedCamera?: string;
  selectedMic?: string;
  micLevel?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
  qualityMode?: QualityModeName;
  currentGridAspectRatio: '16:9' | '9:16' | '1:1' | '4:3';
  cameraHardwareCaps?: CameraHardwareCaps | null;
  canPublish?: boolean;
  inLobby: boolean;
}

export function useMediaSync({
  videoEnabled,
  audioEnabled,
  selectedCamera,
  selectedMic,
  micLevel,
  noiseSuppression,
  echoCancellation,
  qualityMode,
  currentGridAspectRatio,
  cameraHardwareCaps,
  canPublish,
  inLobby,
}: UseMediaSyncProps) {
  const { localParticipant } = useLocalParticipant();
  const [initialMediaSynced, setInitialMediaSynced] = useState(false);

  useEffect(() => {
    if (initialMediaSynced || !localParticipant.identity) return;
    if (canPublish === false) return;

    let cancelled = false;

    const syncInitialMedia = async () => {
      try {
        if (videoEnabled !== localParticipant.isCameraEnabled) {
          await localParticipant.setCameraEnabled(videoEnabled, videoEnabled
            ? buildCameraCaptureOptions(selectedCamera, qualityMode, currentGridAspectRatio, cameraHardwareCaps)
            : undefined);
        }
      } catch (e) {
        logger.error('[RoomPage] Failed to sync camera state:', e);
        return;
      }

      if (cancelled) return;

      try {
        if (audioEnabled !== localParticipant.isMicrophoneEnabled) {
          await localParticipant.setMicrophoneEnabled(audioEnabled, audioEnabled
            ? buildAudioCaptureOptions(selectedMic, noiseSuppression, echoCancellation, micLevel)
            : undefined);
        }
      } catch (e) {
        logger.error('[RoomPage] Failed to sync microphone state:', e);
        return;
      }

      if (!cancelled) {
        setInitialMediaSynced(true);
      }
    };

    const timer = setTimeout(() => { void syncInitialMedia(); }, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    initialMediaSynced,
    localParticipant,
    localParticipant.identity,
    canPublish,
    videoEnabled,
    audioEnabled,
    selectedCamera,
    selectedMic,
    micLevel,
    noiseSuppression,
    echoCancellation,
    qualityMode,
    currentGridAspectRatio,
    cameraHardwareCaps,
  ]);

  useEffect(() => {
    if (canPublish && inLobby) {
      setInitialMediaSynced(false);
    }
  }, [canPublish, inLobby]);

  return { initialMediaSynced };
}
