import { useTracks, VideoTrack, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { ParticipantTile } from './ParticipantTile';

export function ScreenShareLayout() {
  const screenTracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio]);
  const participants = useParticipants();
  
  // Get the main screen share track
  const mainTrack = screenTracks.find(t => t.publication.source === Track.Source.ScreenShare);

  return (
    <div className="flex h-full gap-2">
      {/* Screen share main view */}
      <div className="flex-1 min-w-0 bg-surface-800 rounded-xl overflow-hidden">
        {mainTrack && mainTrack.publication.track ? (
          <VideoTrack 
            key={mainTrack.publication.trackSid}
            trackRef={{ 
              participant: mainTrack.participant, 
              publication: mainTrack.publication, 
              source: Track.Source.ScreenShare 
            }} 
            className="w-full h-full object-contain" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-surface-500">
            No screen share active
          </div>
        )}
      </div>
      
      {/* Participants sidebar */}
      <div className="w-48 flex flex-col gap-2 overflow-y-auto flex-shrink-0">
        {participants.map(p => (
          <ParticipantTile 
            key={p.identity} 
            participant={p} 
            className="w-full aspect-video flex-shrink-0" 
          />
        ))}
      </div>
    </div>
  );
}
