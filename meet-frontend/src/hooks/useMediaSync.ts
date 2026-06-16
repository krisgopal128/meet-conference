/**
 * useMediaSync - Handles initial media state synchronization
 * 
 * Extracted from RoomPage.RoomContent to reduce component complexity.
 */

import { useEffect, useState } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  buildCameraCaptureOptions,
  buildAudioCaptureOptions,
} from '../config/meetingRoomConfig';
import { withOperationTimeout } from '../utils/asyncTimeout';
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
  pendingVideoTrack?: MediaStreamTrack | null;
  pendingAudioTrack?: MediaStreamTrack | null;
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
  pendingVideoTrack,
  pendingAudioTrack,
}: UseMediaSyncProps) {
  const { localParticipant } = useLocalParticipant();
  const [initialMediaSynced, setInitialMediaSynced] = useState(false);

  useEffect(() => {
    if (initialMediaSynced || !localParticipant.identity) return;
    if (canPublish === false) return;

    let cancelled = false;

    const syncInitialMedia = async () => {
      try {
        if (videoEnabled && !localParticipant.isCameraEnabled) {
          if (pendingVideoTrack && pendingVideoTrack.readyState === 'live') {
            try {
              await localParticipant.publishTrack(pendingVideoTrack, { source: Track.Source.Camera });
              logger.info('[MediaSync] Published pre-created video track (no getUserMedia)');
            } catch (e) {
              logger.warn('[MediaSync] Failed to publish pending video track, falling back:', e);
              pendingVideoTrack.stop();
              await withOperationTimeout(
                localParticipant.setCameraEnabled(true, buildCameraCaptureOptions(selectedCamera, qualityMode, currentGridAspectRatio, cameraHardwareCaps)),
                'MEDIA_TOGGLE',
                'Sync camera state'
              );
            }
          } else {
            await withOperationTimeout(
              localParticipant.setCameraEnabled(true, buildCameraCaptureOptions(selectedCamera, qualityMode, currentGridAspectRatio, cameraHardwareCaps)),
              'MEDIA_TOGGLE',
              'Sync camera state'
            );
          }
        } else if (!videoEnabled && pendingVideoTrack) {
          pendingVideoTrack.stop();
        }
      } catch (e) {
        logger.error('[RoomPage] Failed to sync camera state:', e);
        return;
      }

      if (cancelled) return;

      try {
        if (audioEnabled && !localParticipant.isMicrophoneEnabled) {
          if (pendingAudioTrack && pendingAudioTrack.readyState === 'live') {
            try {
              await localParticipant.publishTrack(pendingAudioTrack, { source: Track.Source.Microphone });
              logger.info('[MediaSync] Published pre-created audio track (no getUserMedia)');
            } catch (e) {
              logger.warn('[MediaSync] Failed to publish pending audio track, falling back:', e);
              pendingAudioTrack.stop();
              await withOperationTimeout(
                localParticipant.setMicrophoneEnabled(true, buildAudioCaptureOptions(selectedMic, noiseSuppression, echoCancellation, micLevel)),
                'MEDIA_TOGGLE',
                'Sync microphone state'
              );
            }
          } else {
            await withOperationTimeout(
              localParticipant.setMicrophoneEnabled(true, buildAudioCaptureOptions(selectedMic, noiseSuppression, echoCancellation, micLevel)),
              'MEDIA_TOGGLE',
              'Sync microphone state'
            );
          }
        } else if (!audioEnabled && pendingAudioTrack) {
          pendingAudioTrack.stop();
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
    pendingVideoTrack,
    pendingAudioTrack,
  ]);

  useEffect(() => {
    if (canPublish && inLobby) {
      setInitialMediaSynced(false);
    }
  }, [canPublish, inLobby]);

  return { initialMediaSynced };
}
