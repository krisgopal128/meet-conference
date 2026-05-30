import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { Track } from 'livekit-client';
import { useTracks } from '@livekit/components-react';

interface CameraTrackReference {
  participant: { identity: string };
  publication?: any;
  source: Track.Source;
}

const RoomCameraTracksContext = createContext<Map<string, CameraTrackReference>>(new Map());

export function RoomCameraTracksProvider({ children }: { children: ReactNode }) {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false }) as CameraTrackReference[];

  const trackMap = useMemo(() => {
    const next = new Map<string, CameraTrackReference>();
    for (const track of tracks) {
      next.set(track.participant.identity, track);
    }
    return next;
  }, [tracks]);

  return (
    <RoomCameraTracksContext.Provider value={trackMap}>
      {children}
    </RoomCameraTracksContext.Provider>
  );
}

export function useRoomCameraTrack(identity: string) {
  const trackMap = useContext(RoomCameraTracksContext);
  return trackMap.get(identity);
}
