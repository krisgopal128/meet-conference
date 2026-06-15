import { useTracks, VideoTrack, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useMemo } from 'react';

const ASPECT_RATIO_CSS: Record<GridAspectRatio, string> = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1': '1/1',
  '4:3': '4/3',
};

const ASPECT_RATIO_MULTIPLIERS: Record<GridAspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
};

export function ScreenShareLayout() {
  const screenTracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio]);
  const allParticipants = useParticipants();
  const participants = allParticipants.filter(p => p.permissions?.canPublish !== false);
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();
  
  const mainTrack = screenTracks.find(t => t.publication.source === Track.Source.ScreenShare);

  const mobileStripHeight = useMemo(() => Math.round(window.innerHeight * 0.12), []);
  const mobileTileWidth = mobileStripHeight * ASPECT_RATIO_MULTIPLIERS[aspectRatio];
  const mobileStripGap = useMemo(() => Math.max(6, Math.round(mobileStripHeight * 0.06)), [mobileStripHeight]);
  const mobileStripPaddingX = useMemo(() => Math.max(6, Math.round(mobileStripHeight * 0.08)), [mobileStripHeight]);
  const mobileStripPaddingBottom = useMemo(() => Math.max(6, Math.round(mobileStripHeight * 0.08)), [mobileStripHeight]);

  if (isMobile) {
    return (
      <div className="flex flex-col h-full gap-1">
        <div className="flex-1 min-h-0 bg-surface-800 rounded-lg overflow-hidden">
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
        <div
          className="flex-shrink-0 flex overflow-x-auto overflow-y-hidden"
          style={{
            height: mobileStripHeight,
            gap: `${mobileStripGap}px`,
            paddingInline: `${mobileStripPaddingX}px`,
            paddingBottom: `${mobileStripPaddingBottom}px`,
          }}
        >
          {participants.map(p => (
            <div
              key={p.identity}
              className="flex-shrink-0 h-full rounded-2xl bg-surface-900"
              style={{ width: mobileTileWidth }}
            >
              <ParticipantTile participant={p} className="w-full h-full rounded-2xl" participantCount={participants.length} isSpeakerTile={false} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-2">
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
      
      <div className="w-48 flex flex-col gap-2 overflow-y-auto flex-shrink-0">
        {participants.map(p => (
          <div key={p.identity} className="w-full flex-shrink-0" style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] }}>
            <ParticipantTile participant={p} className="w-full h-full" participantCount={participants.length} isSpeakerTile={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
