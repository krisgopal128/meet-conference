/**
 * speakerVolume — single source of truth for the remote-audio volume (0-100).
 *
 * Written by the SettingsPanel slider and read by RoomPage's media-element
 * observer, so late-joining participants get the user's CURRENT volume
 * instead of resetting everyone back to the prejoin level.
 */

const SPEAKER_VOLUME_KEY = 'meet-speaker-volume';

export function getSpeakerVolume(): number {
  try {
    const stored = localStorage.getItem(SPEAKER_VOLUME_KEY);
    if (stored !== null) {
      const value = Number(stored);
      if (Number.isFinite(value) && value >= 0 && value <= 100) {
        return value;
      }
    }
  } catch {
    // localStorage unavailable
  }
  return 100;
}

export function setSpeakerVolume(volume: number): void {
  try {
    localStorage.setItem(SPEAKER_VOLUME_KEY, String(Math.max(0, Math.min(100, Math.round(volume)))));
  } catch {
    // localStorage unavailable
  }
}
