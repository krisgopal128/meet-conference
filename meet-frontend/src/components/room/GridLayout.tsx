/**
 * GridLayout Component
 * 
 * Displays participant tiles in a responsive grid layout.
 *
 * Mobile rules (portrait + landscape):
 *   - 2-column grid, tiles respect aspect ratio, scroll for overflow
 *
 * Desktop rules:
 *   - 2-8: fixed grid with aspect-ratio-correct tiles (no video cropping)
 *   - 9-24: responsive sqrt grid with aspect-ratio-correct tiles
 *   - 25+: scrollable grid with min tile height
 */

import { useParticipants, useLocalParticipant } from '@livekit/components-react';
import { SafeParticipantTile as ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useDebugParticipants, DummyParticipantTile } from '../../debug/DebugParticipants';
import { ASPECT_RATIO_CSS, ASPECT_RATIO_MULTIPLIERS } from '../../utils/aspectRatio';
import { useRef, useState, useEffect, useMemo } from 'react';

const SCROLL_THRESHOLD_DESKTOP = 25;
const MIN_TILE_HEIGHT_DESKTOP = 200;
const DESKTOP_PADDING_PX = 8;
const DESKTOP_GAP_PX = 8;

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

  // Track grid container size for aspect-ratio-correct tile computation
  const gridRef = useRef<HTMLDivElement>(null);
  const [gridSize, setGridSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = gridRef.current;
    if (!el || isMobile) return;
    const update = () => {
      setGridSize({ w: el.clientWidth, h: el.clientHeight });
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [isMobile]);

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

  const gap = isMobile ? 4 : DESKTOP_GAP_PX;
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
  const needsScroll = count > SCROLL_THRESHOLD_DESKTOP;
  const ratioMultiplier = ASPECT_RATIO_MULTIPLIERS[aspectRatio];

  // Compute explicit tile pixel dimensions that maintain the video aspect ratio.
  // Without this, 1fr×1fr grid cells produce arbitrary shapes that don't match
  // the video, causing object-fit:cover to crop increasingly as tiles shrink.
  const tileDims = useMemo(() => {
    if (needsScroll || gridSize.w === 0 || gridSize.h === 0) return null;

    const availW = gridSize.w - DESKTOP_PADDING_PX * 2 - gap * (cols - 1);
    const availH = gridSize.h - DESKTOP_PADDING_PX * 2 - gap * (rows - 1);
    if (availW <= 0 || availH <= 0) return null;

    // Strategy: try both fit-by-width and fit-by-height, pick the one that
    // fits ALL tiles within the available space.
    const wByWidth = availW / cols;
    const hByWidth = wByWidth / ratioMultiplier;

    const hByHeight = availH / rows;
    const wByHeight = hByHeight * ratioMultiplier;

    if (hByWidth * rows <= availH) {
      return { width: Math.floor(wByWidth), height: Math.floor(hByWidth) };
    }
    return { width: Math.floor(wByHeight), height: Math.floor(hByHeight) };
  }, [gridSize, cols, rows, gap, ratioMultiplier, needsScroll]);

  // Scrollable grid (25+): use min-height rows, scroll overflow
  if (needsScroll) {
    return (
      <div
        className={`w-full h-full ${pad} overflow-y-auto`}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridAutoRows: `${MIN_TILE_HEIGHT_DESKTOP}px`,
          gridTemplateRows: 'none',
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

  // Fixed/responsive desktop grid with aspect-ratio-correct tiles
  return (
    <div
      ref={gridRef}
      className={`w-full h-full ${pad} overflow-hidden`}
      style={{
        display: 'grid',
        gridTemplateColumns: tileDims ? `repeat(${cols}, ${tileDims.width}px)` : `repeat(${cols}, 1fr)`,
        gridTemplateRows: tileDims ? `repeat(${rows}, ${tileDims.height}px)` : `repeat(${rows}, 1fr)`,
        justifyContent: 'center',
        alignContent: 'center',
        gap: `${gap}px`,
      }}
    >
      {admittedParticipants.map((p) => (
        <div
          key={p.identity}
          className="relative rounded-2xl bg-surface-900 overflow-hidden"
          style={tileDims ? { width: tileDims.width, height: tileDims.height } : { minWidth: 0, minHeight: 0, aspectRatio: aspectCss }}
        >
          <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} participantCount={count} />
        </div>
      ))}
      {dummyParticipants.map((d) => (
        <div
          key={d.identity}
          className="relative rounded-2xl bg-surface-900 overflow-hidden"
          style={tileDims ? { width: tileDims.width, height: tileDims.height } : { minWidth: 0, minHeight: 0, aspectRatio: aspectCss }}
        >
          <DummyParticipantTile name={d.name} size="small" state={dummyStates[d.identity]} />
        </div>
      ))}
    </div>
  );
}
