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
import { ASPECT_RATIO_CSS } from '../../utils/aspectRatio';
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
    if (count === 3) return { cols: 3, rows: 1 };
    if (count === 4) return { cols: 2, rows: 2 };
    if (count === 5) return { cols: 3, rows: 2 };
    if (count === 6) return { cols: 3, rows: 2 };
    if (count === 7) return { cols: 4, rows: 2 };
    if (count === 8) return { cols: 4, rows: 2 };
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

  // Measure container size to compute optimal tile dimensions
  // that match the video aspect ratio (no cropping, minimal empty space)
  const gridRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const update = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, []);

  // Desktop grid dimensions — computed unconditionally (before any early
  // returns) to satisfy the Rules of Hooks. Without this, going from 1
  // participant to 2 (e.g. adding a dummy) changes the hook count and
  // throws React error #310.
  const isLandscape = aspectRatio === '16:9' || aspectRatio === '4:3';
  const desktopGap = DESKTOP_GAP_PX;
  const { cols, rows } = getGridDimensions(count, aspectRatio);
  const needsScroll = count > SCROLL_THRESHOLD_DESKTOP;

  // Compute optimal tile size: fill the container while preserving the
  // video aspect ratio. Tiles are as large as possible without cropping.
  const tileDims = useMemo(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return null;
    const padTotal = DESKTOP_PADDING_PX * 2;
    const gapTotalW = desktopGap * (cols - 1);
    const gapTotalH = desktopGap * (rows - 1);
    const availW = containerSize.w - padTotal - gapTotalW;
    const availH = containerSize.h - padTotal - gapTotalH;
    if (availW <= 0 || availH <= 0) return null;

    const cellW = availW / cols;
    const cellH = availH / rows;
    const targetAspect = ASPECT_RATIO_CSS[aspectRatio]; // e.g. '16/9'

    // Within each grid cell, fit the largest tile that matches the video
    // aspect ratio (contain semantics — no cropping).
    if (isLandscape) {
      // Landscape video: width-constrained, height fits within cell
      const tileW = cellW;
      const tileH = cellW / parseFloat(targetAspect);
      if (tileH <= cellH) {
        return { width: Math.floor(tileW), height: Math.floor(tileH) };
      }
      // Height-constrained
      return { width: Math.floor(cellH * parseFloat(targetAspect)), height: Math.floor(cellH) };
    } else {
      // Portrait/square video: height-constrained
      const tileH = cellH;
      const tileW = cellH * parseFloat(targetAspect);
      if (tileW <= cellW) {
        return { width: Math.floor(tileW), height: Math.floor(tileH) };
      }
      return { width: Math.floor(cellW), height: Math.floor(cellW / parseFloat(targetAspect)) };
    }
  }, [containerSize, cols, rows, desktopGap, aspectRatio, isLandscape]);

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

  const gap = isMobile ? 4 : desktopGap;
  const pad = isMobile ? 'p-1' : 'p-2';
  const aspectCss = ASPECT_RATIO_CSS[aspectRatio];

  // ── Mobile: 2-column grid, tiles fill available space ──
  if (isMobile) {
    const mobileRows = Math.ceil(count / 2);
    // When few enough to fit on screen, fill the viewport (no scroll).
    // Beyond that, use fixed-height rows with scroll.
    const fitsOnScreen = mobileRows <= 3;
    return (
      <div
        className={`w-full h-full ${pad} ${fitsOnScreen ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'}`}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          ...(fitsOnScreen
            ? { gridTemplateRows: `repeat(${mobileRows}, minmax(0, 1fr))` }
            : { gridAutoRows: '200px' }),
          gap: `${gap}px`,
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) transparent',
        }}
      >
        {admittedParticipants.map((p) => (
          <div key={p.identity} className="relative rounded-2xl bg-surface-900 overflow-hidden min-w-0 min-h-0">
            <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} participantCount={count} />
          </div>
        ))}
        {dummyParticipants.map((d) => (
          <div key={d.identity} className="relative rounded-2xl bg-surface-900 overflow-hidden min-w-0 min-h-0">
            <DummyParticipantTile name={d.name} size="small" state={dummyStates[d.identity]} />
          </div>
        ))}
      </div>
    );
  }

  // ── Desktop: Scrollable grid (25+): use min-height rows, scroll overflow ──
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

  // Fixed/responsive desktop grid — tiles match video aspect ratio (no cropping)
  return (
    <div
      ref={gridRef}
      className={`w-full h-full ${pad} overflow-hidden`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        gap: `${gap}px`,
        placeItems: 'center',
      }}
    >
      {admittedParticipants.map((p) => (
        <div
          key={p.identity}
          className="relative rounded-2xl bg-surface-900 overflow-hidden min-w-0 min-h-0"
          style={tileDims ? { width: `${tileDims.width}px`, height: `${tileDims.height}px` } : { width: '100%', height: '100%' }}
        >
          <ParticipantTile participant={p} className="w-full h-full rounded-2xl" isSpeakerTile={false} participantCount={count} />
        </div>
      ))}
      {dummyParticipants.map((d) => (
        <div
          key={d.identity}
          className="relative rounded-2xl bg-surface-900 overflow-hidden min-w-0 min-h-0"
          style={tileDims ? { width: `${tileDims.width}px`, height: `${tileDims.height}px` } : { width: '100%', height: '100%' }}
        >
          <DummyParticipantTile name={d.name} size="small" state={dummyStates[d.identity]} />
        </div>
      ))}
    </div>
  );
}
