/**
 * GridLayout Component
 * 
 * Displays participant tiles in a responsive CSS Grid layout.
 * 
 * Key principles:
 * 1. For 1 participant: flexbox centering with aspect ratio
 * 2. For 2-8 participants: fixed grid that fills available space
 * 3. For 9-32 participants: responsive grid using sqrt formula (fills space)
 *    - columns = ceil(sqrt(participant_count))
 *    - rows = ceil(participant_count / columns)
 * 4. For 33+ participants: responsive grid with vertical scroll
 * 5. Video inside tiles uses objectFit for cover/contain
 */

import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useIsMobile } from '../../hooks/useIsMobile';

const FIXED_GRID_MAX = 8;
const SCROLL_THRESHOLD_DESKTOP = 9;
const SCROLL_THRESHOLD_MOBILE = 7;
const MIN_TILE_HEIGHT_DESKTOP = 180;
const MIN_TILE_HEIGHT_MOBILE = 120;

const ASPECT_RATIO_CSS: Record<GridAspectRatio, string> = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1': '1/1',
  '4:3': '4/3',
};

function getGridDimensions(count: number, ratio: GridAspectRatio, isMobile: boolean): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };

  if (isMobile) {
    if (ratio === '9:16') {
      if (count === 2) return { cols: 1, rows: 2 };
      if (count <= 4) return { cols: 2, rows: 2 };
      if (count <= 6) return { cols: 2, rows: 3 };
      if (count <= 9) return { cols: 3, rows: 3 };
    } else {
      if (count === 2) return { cols: 2, rows: 1 };
      if (count <= 4) return { cols: 2, rows: 2 };
      if (count <= 6) return { cols: 2, rows: 3 };
      if (count <= 9) return { cols: 3, rows: 3 };
    }
  }
  
  if (ratio === '9:16') {
    if (count === 2) return { cols: 1, rows: 2 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 2, rows: 3 };
    if (count <= 8) return { cols: 2, rows: 4 };
  } else {
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 8) return { cols: 4, rows: 2 };
  }
  
  const cols = isMobile ? Math.min(Math.ceil(Math.sqrt(count)), 3) : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  
  return { cols, rows };
}

export function GridLayout() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();

  const admittedParticipants = useAdmittedParticipants(participants, localParticipant?.identity);
  const count = admittedParticipants.length;
  const isSingleParticipant = count === 1;
  
  const isLandscape = aspectRatio === '16:9' || aspectRatio === '4:3';

  if (isSingleParticipant) {
    return (
      <div className="w-full h-full flex items-center justify-center">
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
            participant={admittedParticipants[0]} 
            className="w-full h-full rounded-2xl" 
            isSpeakerTile={true}
            participantCount={count}
          />
        </div>
      </div>
    );
  }

  const { cols, rows } = getGridDimensions(count, aspectRatio, isMobile);
  const useFixedGrid = count <= FIXED_GRID_MAX;
  const scrollThreshold = isMobile ? SCROLL_THRESHOLD_MOBILE : SCROLL_THRESHOLD_DESKTOP;
  const needsScroll = count > scrollThreshold;
  const minTileHeight = isMobile ? MIN_TILE_HEIGHT_MOBILE : MIN_TILE_HEIGHT_DESKTOP;

  return (
    <div
      className={`w-full h-full ${isMobile ? 'p-1' : 'p-2'} ${needsScroll ? 'overflow-y-auto' : 'overflow-hidden'}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        ...(needsScroll
          ? {
              gridAutoRows: `${minTileHeight}px`,
              gridTemplateRows: 'none',
              alignContent: 'start',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
            }
          : {
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              alignContent: useFixedGrid ? 'center' : 'start',
            }),
        gap: isMobile ? '4px' : '8px',
      }}
    >
      {admittedParticipants.map((p) => (
        <div
          key={p.identity}
          className="relative flex items-center justify-center rounded-2xl h-full"
        >
          <div
            className="relative rounded-2xl bg-surface-900 overflow-hidden"
            style={{
              width: '100%',
              height: '100%',
            }}
          >
            <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} participantCount={count} />
          </div>
        </div>
      ))}
    </div>
  );
}
