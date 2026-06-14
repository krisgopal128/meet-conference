/**
 * SpeakerLayout Component
 * 
 * Displays one featured participant (speaker) prominently with other
 * participants in a horizontal filmstrip at the bottom.
 * 
 * Key principles:
 * 1. Featured participant is centered with aspect ratio constraint
 * 2. For landscape, set width: 100% and let height calculate from aspect ratio
 * 3. For portrait, set height: 100% and let width calculate from aspect ratio
 * 4. Filmstrip shows remaining participants in fixed-height strip
 */

import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { Participant } from 'livekit-client';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { usePinnedIdentity, useGridAspectRatio } from '../../store/roomStore';
import { useMemo } from 'react';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useIsMobile } from '../../hooks/useIsMobile';
import { ASPECT_RATIO_MULTIPLIERS, ASPECT_RATIO_CSS } from '../../utils/aspectRatio';

interface SpeakerLayoutProps {
  activeSpeakers: Participant[];
}

export function SpeakerLayout({ activeSpeakers }: SpeakerLayoutProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const pinnedIdentity = usePinnedIdentity();
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();

  const filmstripHeight = isMobile ? '15dvh' : '140px';

  const filmstripPx = useMemo(() => {
    if (!isMobile) return 140;
    return Math.round(window.innerHeight * 0.15);
  }, [isMobile]);

  const filmstripTileWidth = useMemo(() => {
    const h = isMobile ? filmstripPx : 140;
    return h * ASPECT_RATIO_MULTIPLIERS[aspectRatio];
  }, [aspectRatio, filmstripPx, isMobile]);

  const filmstripGap = useMemo(() => Math.max(6, Math.round(filmstripPx * 0.06)), [filmstripPx]);
  const filmstripPaddingX = useMemo(() => Math.max(6, Math.round(filmstripPx * 0.08)), [filmstripPx]);
  const filmstripPaddingBottom = useMemo(() => Math.max(6, Math.round(filmstripPx * 0.08)), [filmstripPx]);

  const admittedParticipants = useAdmittedParticipants(participants, localParticipant?.identity);

  const featured = useMemo(() => {
    if (pinnedIdentity) {
      return admittedParticipants.find(p => p.identity === pinnedIdentity);
    }
    const activeSpeaker = activeSpeakers.find(s => 
      admittedParticipants.some(a => a.identity === s.identity)
    );
    return activeSpeaker || admittedParticipants[0];
  }, [pinnedIdentity, activeSpeakers, admittedParticipants]);

  const rest = admittedParticipants.filter(p => p !== featured);

  const isLandscape = aspectRatio === '16:9' || aspectRatio === '4:3';

  return (
    <div className={`flex flex-col h-full ${rest.length > 0 ? 'gap-1 sm:gap-2' : ''}`}>
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {featured ? (
          <div
            className="relative rounded-2xl bg-surface-900"
            style={{
              aspectRatio: ASPECT_RATIO_CSS[aspectRatio],
              width: isLandscape ? '100%' : 'auto',
              height: isLandscape ? 'auto' : '100%',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <ParticipantTile 
              participant={featured} 
              className="w-full h-full rounded-2xl" 
              isSpeakerTile={true} 
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-surface-500">
            Waiting for participants...
          </div>
        )}
      </div>

      {rest.length > 0 && (
        <div
          className="flex flex-shrink-0 overflow-x-auto overflow-y-hidden"
          style={{
            height: filmstripHeight,
            gap: `${filmstripGap}px`,
            paddingInline: `${filmstripPaddingX}px`,
            paddingBottom: `${filmstripPaddingBottom}px`,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          }}
        >
          {rest.map((p) => (
            <div
              key={p.identity}
              className="flex-shrink-0 h-full rounded-2xl bg-surface-900"
              style={{ width: filmstripTileWidth }}
            >
              <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
