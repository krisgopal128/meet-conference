/**
 * GridLayout Component
 * 
 * Displays participant tiles in a responsive CSS Grid layout.
 *
 * Mobile rules (portrait + landscape):
 *   - Max 4 tiles visible at a time (2×2 grid that fills the screen)
 *   - 5+ participants: same 2×2 viewport, rest scroll vertically
 *
 * Desktop rules:
 *   - 2-8: fixed grid that fills available space
 *   - 9-24: responsive sqrt grid
 *   - 25+: scrollable grid with min tile height
 */

import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useDebugParticipants, DummyParticipantTile } from '../../debug/DebugParticipants';
import { ASPECT_RATIO_CSS } from '../../utils/aspectRatio';

const FIXED_GRID_MAX = 8;
const SCROLL_THRESHOLD_DESKTOP = 25;
const MIN_TILE_HEIGHT_DESKTOP = 200;

function getGridDimensions(count: number, ratio: GridAspectRatio): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };

  if (ratio === '9:16') {
    if (count === 2) return { cols: 1, rows: 2 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 2, rows: 3 };
    if (count <= 8) return { cols: 2, rows: 4 };
  } else {
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count === 7) return { cols: 3, rows: 3 };
    if (count === 8) return { cols: 3, rows: 3 };
  }

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

export function GridLayout() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();
  const { dummyParticipants, dummyStates } = useDebugParticipants();
  const admittedParticipants = useAdmittedParticipants(participants, localParticipant?.identity);
  const count = admittedParticipants.length + dummyParticipants.length;
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

  const gap = isMobile ? 4 : 8;
  const pad = isMobile ? 'p-1' : 'p-2';
  const aspectCss = ASPECT_RATIO_CSS[aspectRatio];

  // ── Mobile: 2-column grid, tiles respect aspect ratio, scroll for overflow ──
  if (isMobile) {
    return (
      <div
        className={`w-full h-full ${pad} overflow-y-auto overflow-x-hidden`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gridAutoRows: 'min-content',
          alignContent: 'start',
          gap: `${gap}px`,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) transparent',
        }}
      >
        {admittedParticipants.map((p) => (
          <div key={p.identity} className="relative rounded-2xl bg-surface-900 overflow-hidden" style={{ aspectRatio: aspectCss }}>
            <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} participantCount={count} />
          </div>
        ))}
        {dummyParticipants.map((d) => (
          <div key={d.identity} className="relative rounded-2xl bg-surface-900 overflow-hidden" style={{ aspectRatio: aspectCss }}>
            <DummyParticipantTile name={d.name} size="small" state={dummyStates[d.identity]} />
          </div>
        ))}
      </div>
    );
  }

  // ── Desktop ──
  const { cols, rows } = getGridDimensions(count, aspectRatio);
  const useFixedGrid = count <= FIXED_GRID_MAX;
  const needsScroll = count > SCROLL_THRESHOLD_DESKTOP;

  return (
    <div
      className={`w-full h-full ${pad} ${needsScroll ? 'overflow-y-auto' : 'overflow-hidden'}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        ...(needsScroll
          ? {
              gridAutoRows: `${MIN_TILE_HEIGHT_DESKTOP}px`,
              gridTemplateRows: 'none',
              alignContent: 'start',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.3) transparent',
            }
          : {
              gridTemplateRows: `repeat(${rows}, 1fr)`,
              alignContent: useFixedGrid ? 'center' : 'start',
            }),
        gap: `${gap}px`,
      }}
    >
      {admittedParticipants.map((p) => (
        <div
          key={p.identity}
          className="relative rounded-2xl bg-surface-900 overflow-hidden"
          style={{ minWidth: 0, minHeight: 0 }}
        >
          <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} participantCount={count} />
        </div>
      ))}
      {dummyParticipants.map((d) => (
        <div
          key={d.identity}
          className="relative rounded-2xl bg-surface-900 overflow-hidden"
          style={{ minWidth: 0, minHeight: 0 }}
        >
          <DummyParticipantTile name={d.name} size="small" state={dummyStates[d.identity]} />
        </div>
      ))}
    </div>
  );
}
