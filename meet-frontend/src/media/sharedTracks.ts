import logger from '../utils/logger';

let pendingVideoTrack: MediaStreamTrack | null = null;
let pendingAudioTrack: MediaStreamTrack | null = null;

export function setPendingTracks(
  video: MediaStreamTrack | null,
  audio: MediaStreamTrack | null,
): void {
  pendingVideoTrack = video;
  pendingAudioTrack = audio;
  if (video || audio) {
    logger.info('[SharedTracks] Stored pending tracks for room page', {
      video: !!video,
      audio: !!audio,
    });
  }
}

export function consumePendingVideoTrack(): MediaStreamTrack | null {
  const track = pendingVideoTrack;
  pendingVideoTrack = null;
  return track;
}

export function consumePendingAudioTrack(): MediaStreamTrack | null {
  const track = pendingAudioTrack;
  pendingAudioTrack = null;
  return track;
}

export function stopPendingTracks(): void {
  if (pendingVideoTrack) {
    pendingVideoTrack.stop();
    pendingVideoTrack = null;
  }
  if (pendingAudioTrack) {
    pendingAudioTrack.stop();
    pendingAudioTrack = null;
  }
}
