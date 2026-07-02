import { useTracks, VideoTrack, useParticipants } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio } from '../../store/roomStore';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { ASPECT_RATIO_CSS, ASPECT_RATIO_MULTIPLIERS } from '../../utils/aspectRatio';
import { useMemo } from 'react';

export function ScreenShareLayout() {
  const screenTracks = useTracks([Track.Source.ScreenShare, Track.Source.ScreenShareAudio]);
  const allParticipants = useParticipants();
  const participants = useAdmittedParticipants(allParticipants, undefined);
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();

  const mainTrack = screenTracks.find(t => t.publication.source === Track.Source.ScreenShare);

  // Filmstrip dimensions — kept in sync with SpeakerLayout for visual consistency
  const filmstripHeightCss = isMobile ? '18dvh' : '140px';
  const filmstripPx = useMemo(() => {
    if (!isMobile) return 140;
    return Math.max(90, Math.round(window.innerHeight * 0.18));
  }, [isMobile]);
  const filmstripTileWidth = useMemo(() => {
    const usableH = isMobile ? filmstripPx - Math.max(6, Math.round(filmstripPx * 0.08)) : 140;
    return Math.round(usableH * ASPECT_RATIO_MULTIPLIERS[aspectRatio]);
  }, [aspectRatio, filmstripPx, isMobile]);
  const filmstripGap = useMemo(() => Math.max(6, Math.round(filmstripPx * 0.06)), [filmstripPx]);
  const filmstripPaddingX = useMemo(() => Math.max(6, Math.round(filmstripPx * 0.08)), [filmstripPx]);
  const filmstripPaddingBottom = useMemo(() => Math.max(6, Math.round(filmstripPx * 0.08)), [filmstripPx]);

  if (isMobile) {
    return (
      <div className={`flex flex-col h-full ${participants.length > 0 ? 'gap-1 sm:gap-2' : ''}`}>
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
        {participants.length > 0 && (
          <div
            className="flex flex-shrink-0 overflow-x-auto overflow-y-hidden"
            style={{
              height: filmstripHeightCss,
              gap: `${filmstripGap}px`,
              paddingInline: `${filmstripPaddingX}px`,
              paddingBottom: `${filmstripPaddingBottom}px`,
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
            }}
          >
            {participants.map(p => (
              <div
                key={p.identity}
                className="flex-shrink-0 h-full rounded-2xl bg-surface-900"
                style={{ width: filmstripTileWidth }}
              >
                <ParticipantTile participant={p} className="w-full h-full rounded-2xl" participantCount={participants.length} isSpeakerTile={false} />
              </div>
            ))}
          </div>
        )}
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

      <div
        className="w-48 flex flex-col gap-2 overflow-y-auto flex-shrink-0"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}
      >
        {participants.map(p => (
          <div key={p.identity} className="w-full flex-shrink-0 rounded-2xl bg-surface-900 overflow-hidden" style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] }}>
            <ParticipantTile participant={p} className="w-full h-full rounded-2xl" participantCount={participants.length} isSpeakerTile={false} />
          </div>
        ))}
      </div>
    </div>
  );
}
