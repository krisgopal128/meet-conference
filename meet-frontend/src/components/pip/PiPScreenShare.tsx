/**
 * PiPScreenShare - Screen share display component for Picture-in-Picture
 */

import { memo, useEffect, useState } from 'react';
import { VideoTrack, ParticipantName } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { Monitor, User } from 'lucide-react';

interface PiPScreenShareProps {
  participant: import('livekit-client').Participant;
  publication: import('livekit-client').TrackPublication;
}

export const PiPScreenShare = memo(function PiPScreenShare({
  participant,
  publication,
}: PiPScreenShareProps) {
  const [isVideoPaused, setIsVideoPaused] = useState(false);

  const track = publication?.track;

  useEffect(() => {
    if (!track) return;

    const handleStreamStateChange = () => {
      const trackAny = track as unknown as { streamState?: string };
      setIsVideoPaused(trackAny.streamState === 'paused');
    };

    handleStreamStateChange();
    // Handle both older and newer LiveKit APIs
    const trackAny = track as unknown as { on: (event: string, cb: () => void) => void; off: (event: string, cb: () => void) => void };
    trackAny.on('streamStateChanged', handleStreamStateChange);

    return () => {
      trackAny.off('streamStateChanged', handleStreamStateChange);
    };
  }, [track]);

  if (!track) {
    return (
      <div className="pip-screenshare-placeholder w-full h-full flex items-center justify-center bg-surface-800">
        <div className="text-center text-surface-400">
          <Monitor size={32} className="mx-auto mb-2 opacity-50" />
          <p className="text-sm">Screen share ended</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pip-screenshare relative w-full h-full bg-black">
      <VideoTrack
        trackRef={{
          participant,
          publication,
          source: Track.Source.ScreenShare,
        }}
        className="w-full h-full object-contain"
      />

      {isVideoPaused && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="text-center text-white">
            <Monitor size={32} className="mx-auto mb-2 opacity-70" />
            <p className="text-sm">Screen share paused</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
        <div className="bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-2">
          <Monitor size={14} className="text-brand-400" />
          <div className="flex items-center gap-1.5">
            <User size={12} className="text-surface-300" />
            <span className="text-xs text-white font-medium">
              <ParticipantName participant={participant} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});
