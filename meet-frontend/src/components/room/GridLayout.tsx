/**
 * GridLayout Component
 *
 * Participant-count-aware gallery, modeled on MS Teams' Gallery view.
 *
 * Desktop (landscape ratios):
 *   1: full-size single tile
 *   2: 2x1 | 3-4: 2x2 | 5-6: 3x2 | 7-9: 3x3 | 10-16: 4 cols | 17-25: 5x5
 * 25+: paginate in 5x5 pages (25 per page) with < > controls
 *   Rows are balanced: remainder tiles are distributed across rows and
 *   centered (e.g. 5 = 3 top + 2 centered, 7 = 3+2+2).
 *
 * Desktop (portrait ratio 9:16):
 *   2: 1x2 | 3-4: 2x2 | 5-6: 2x3 | 7-8: 2x4 | 9+: sqrt grid, 25+ paginates
 *
 * Mobile:
 *   1: full | 2: vertical stack (1 col) | 3+: 2 columns, scroll past 3 rows
 *
 * Video fitting (cover/contain, portrait handling) is owned by ParticipantTile.
 */

import { useMemo, useState } from 'react';
import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useDebugParticipants, DummyParticipantTile, type DummyParticipant } from '../../debug/DebugParticipants';
import { ASPECT_RATIO_CSS } from '../../utils/aspectRatio';
import { type Participant } from 'livekit-client';

const MAX_TILES_PER_PAGE = 25;
const DESKTOP_GAP_PX = 4;

type GridItem =
  | { kind: 'participant'; participant: Participant }
  | { kind: 'dummy'; dummy: DummyParticipant };

/**
 * Teams-style grid shape for a given tile count.
 * Table-driven for small counts (matches Teams Gallery), sqrt-based beyond,
 * capped at 5 columns (a page never holds more than 25 tiles).
 */
export function getGridDimensions(count: number, ratio: GridAspectRatio): { cols: number; rows: number } {
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
    if (count <= 9) return { cols: 3, rows: 3 };
  }

  const cols = Math.min(5, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  return { cols, rows };
}

/**
 * Distributes `count` tiles across rows of at most `cols`, balancing the
 * remainder so short rows differ by at most one tile and the fullest rows
 * come first (e.g. 5/3 -> [3,2], 7/3 -> [3,2,2], 10/4 -> [4,3,3]).
 */
export function getBalancedRows(count: number, cols: number): number[] {
  if (count <= 0 || cols <= 0) return [];
  const rowCount = Math.ceil(count / cols);
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  return Array.from({ length: rowCount }, (_, i) => base + (i < extra ? 1 : 0));
}

export function GridLayout() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const aspectRatio = useGridAspectRatio();
  const isMobile = useIsMobile();
  const { dummyParticipants, dummyStates } = useDebugParticipants();
  const admittedParticipants = useAdmittedParticipants(participants, localParticipant?.identity);
  const [page, setPage] = useState(0);

  const count = admittedParticipants.length + dummyParticipants.length;
  const isSingleParticipant = count === 1;
  const pageCount = Math.max(1, Math.ceil(count / MAX_TILES_PER_PAGE));
  const clampedPage = Math.min(page, pageCount - 1);

  const aspectCss = ASPECT_RATIO_CSS[aspectRatio];
  const isLandscape = aspectRatio === '16:9' || aspectRatio === '4:3';
  const gap = isMobile ? 2 : DESKTOP_GAP_PX;
  const pad = isMobile ? 'p-0.5' : 'p-1';

  // Combined render list (real participants, then debug dummies), sliced per page
  const pageItems = useMemo<GridItem[]>(() => {
    const all: GridItem[] = [
      ...admittedParticipants.map((p): GridItem => ({ kind: 'participant', participant: p })),
      ...dummyParticipants.map((d): GridItem => ({ kind: 'dummy', dummy: d })),
    ];
    const start = clampedPage * MAX_TILES_PER_PAGE;
    return all.slice(start, start + MAX_TILES_PER_PAGE);
  }, [admittedParticipants, dummyParticipants, clampedPage]);

  const { cols } = getGridDimensions(pageItems.length, aspectRatio);
  const balancedRows = getBalancedRows(pageItems.length, cols);

  const renderTile = (item: GridItem, size: 'normal' | 'small' = 'normal') => {
    if (item.kind === 'dummy') {
      return (
        <div key={item.dummy.identity} className="relative rounded-2xl bg-surface-900 overflow-hidden w-full h-full">
          <DummyParticipantTile name={item.dummy.name} size={size} state={dummyStates[item.dummy.identity]} />
        </div>
      );
    }
    const p = item.participant;
    return (
      <div key={p.identity} className="relative rounded-2xl bg-surface-900 overflow-hidden w-full h-full">
        <ParticipantTile
          participant={p}
          className="w-full h-full rounded-2xl"
          isSpeakerTile={false}
          participantCount={count}
        />
      </div>
    );
  };

  if (isSingleParticipant) {
    const only = pageItems[0];
    const participant = only?.kind === 'participant' ? only.participant : undefined;

    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="relative rounded-2xl bg-surface-900 overflow-hidden"
          style={{
            aspectRatio: aspectCss,
            width: isLandscape ? '100%' : 'auto',
            height: isLandscape ? 'auto' : '100%',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        >
          {participant && (
            <ParticipantTile
              participant={participant}
              className="w-full h-full rounded-2xl"
              isSpeakerTile={true}
              participantCount={count}
            />
          )}
          {only?.kind === 'dummy' && (
            <DummyParticipantTile name={only.dummy.name} size="normal" state={dummyStates[only.dummy.identity]} />
          )}
        </div>
      </div>
    );
  }

  // ── Mobile: 1 participant full, 2 stacked vertically, 3+ two-column ──
  if (isMobile) {
    const mobileCols = count === 2 ? 1 : 2;
    const mobileRows = Math.ceil(count / mobileCols);
    const fitsOnScreen = mobileRows <= 3;
    return (
      <div
        className={`w-full h-full ${pad} ${fitsOnScreen ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${mobileCols}, minmax(0, 1fr))`,
          ...(fitsOnScreen
            ? { gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))` }
            : { gridAutoRows: '200px' }),
          gap: `${gap}px`,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) transparent',
        }}
      >
        {admittedParticipants.map((p) => renderTile({ kind: 'participant', participant: p }, 'small'))}
        {dummyParticipants.map((d) => renderTile({ kind: 'dummy', dummy: d }, 'small'))}
      </div>
    );
  }

  // ── Desktop: balanced flex rows, paginated at 25 tiles ──
  const pagination = pageCount > 1 && (
    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Previous page"
        disabled={clampedPage === 0}
        onClick={() => setPage(Math.max(0, clampedPage - 1))}
        className="text-white/90 disabled:text-white/30 hover:text-white transition-colors"
      >
        <ChevronLeft size={18} />
      </button>
      <span className="text-xs text-white/80 tabular-nums select-none">
        {clampedPage + 1} / {pageCount}
      </span>
      <button
        type="button"
        aria-label="Next page"
        disabled={clampedPage >= pageCount - 1}
        onClick={() => setPage(Math.min(pageCount - 1, clampedPage + 1))}
        className="text-white/90 disabled:text-white/30 hover:text-white transition-colors"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );

  let rowStart = 0;
  return (
    <div className={`relative w-full h-full ${pad} overflow-hidden`}>
      <div className="w-full h-full flex flex-col" style={{ gap: `${gap}px` }}>
        {balancedRows.map((rowSize, rowIndex) => {
          const rowItems = pageItems.slice(rowStart, rowStart + rowSize);
          rowStart += rowSize;
          return (
            <div
              key={rowIndex}
              className="flex min-h-0 justify-center"
              style={{ flex: '1 1 0%', gap: `${gap}px` }}
            >
              {rowItems.map((item) => (
                <div
                  key={item.kind === 'participant' ? item.participant.identity : item.dummy.identity}
                  className="min-w-0 h-full"
                  style={{ width: `calc((100% - ${(cols - 1) * gap}px) / ${cols})` }}
                >
                  {renderTile(item)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {pagination}
    </div>
  );
}
