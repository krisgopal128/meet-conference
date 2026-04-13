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
import { ParticipantTile } from './ParticipantTile';
import { usePinnedIdentity, useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useMemo } from 'react';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';

interface SpeakerLayoutProps {
  activeSpeakers: Participant[];
}

const ASPECT_RATIO_MULTIPLIERS: Record<GridAspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3,
};

const ASPECT_RATIO_CSS: Record<GridAspectRatio, string> = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1': '1/1',
  '4:3': '4/3',
};

const FILMSTRIP_HEIGHT = 140;

export function SpeakerLayout({ activeSpeakers }: SpeakerLayoutProps) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const pinnedIdentity = usePinnedIdentity();
  const aspectRatio = useGridAspectRatio();

  const filmstripTileWidth = useMemo(() => {
    return FILMSTRIP_HEIGHT * ASPECT_RATIO_MULTIPLIERS[aspectRatio];
  }, [aspectRatio]);

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

  // Determine if aspect ratio is landscape (width > height)
  const isLandscape = aspectRatio === '16:9' || aspectRatio === '4:3';

  return (
    <div className={`flex flex-col h-full ${rest.length > 0 ? 'gap-2' : ''}`}>
      {/* Main speaker area */}
      <div className="flex-1 min-h-0 flex items-center justify-center">
        {featured ? (
          <div
            className="relative rounded-lg bg-surface-900"
            style={{
              aspectRatio: ASPECT_RATIO_CSS[aspectRatio],
              // For landscape: width drives the size, height calculates from aspect ratio
              // For portrait: height drives the size, width calculates from aspect ratio
              width: isLandscape ? '100%' : 'auto',
              height: isLandscape ? 'auto' : '100%',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
          >
            <ParticipantTile 
              participant={featured} 
              className="w-full h-full rounded-lg" 
              isSpeakerTile={true} 
            />
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-surface-500">
            Waiting for participants...
          </div>
        )}
      </div>

      {/* Filmstrip */}
      {rest.length > 0 && (
        <div
          className="flex gap-2 flex-shrink-0 overflow-x-auto overflow-y-hidden px-2 pb-2"
          style={{
            height: FILMSTRIP_HEIGHT,
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.3) transparent',
          }}
        >
          {rest.map((p) => (
            <div
              key={p.identity}
              className="flex-shrink-0 h-full rounded-lg bg-surface-900"
              style={{ width: filmstripTileWidth }}
            >
              <ParticipantTile participant={p} className="w-full h-full rounded-lg" isSpeakerTile={false} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
