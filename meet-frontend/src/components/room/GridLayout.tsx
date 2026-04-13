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
import { ParticipantTile } from './ParticipantTile';
import { useGridAspectRatio, type GridAspectRatio } from '../../store/roomStore';
import { useAdmittedParticipants } from '../../hooks/useAdmittedParticipants';

const FIXED_GRID_MAX = 8;
const SCROLL_THRESHOLD = 32; // Enable scroll for 33+ participants

const ASPECT_RATIO_CSS: Record<GridAspectRatio, string> = {
  '16:9': '16/9',
  '9:16': '9/16',
  '1:1': '1/1',
  '4:3': '4/3',
};

/**
 * Calculate optimal grid dimensions
 * 
 * For 9+ participants, uses responsive formula:
 * - columns = ceil(sqrt(participant_count))
 * - rows = ceil(participant_count / columns)
 * 
 * Examples:
 * - 9 participants: sqrt(9) = 3, cols = 3, rows = 3 → 3×3 grid
 * - 10 participants: sqrt(10) ≈ 3.16, cols = 4, rows = 3 → 4×3 grid
 * - 16 participants: sqrt(16) = 4, cols = 4, rows = 4 → 4×4 grid
 * - 25 participants: sqrt(25) = 5, cols = 5, rows = 5 → 5×5 grid
 * - 32 participants: sqrt(32) ≈ 5.66, cols = 6, rows = 6 → 6×6 grid
 * - 33 participants: sqrt(33) ≈ 5.74, cols = 6, rows = 6 → 6×6 grid + scroll
 */
function getGridDimensions(count: number, ratio: GridAspectRatio): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  
  // For 2-8 participants: use fixed dimensions for better appearance
  // Portrait mode - prefer vertical stacking
  if (ratio === '9:16') {
    if (count === 2) return { cols: 1, rows: 2 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 2, rows: 3 };
    if (count <= 8) return { cols: 2, rows: 4 };
  } else {
    // Landscape modes (16:9, 4:3, 1:1) - prefer horizontal expansion
    if (count === 2) return { cols: 2, rows: 1 };
    if (count <= 4) return { cols: 2, rows: 2 };
    if (count <= 6) return { cols: 3, rows: 2 };
    if (count <= 8) return { cols: 4, rows: 2 };
  }
  
  // For 9+ participants: use responsive formula
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  
  return { cols, rows };
}

export function GridLayout() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const aspectRatio = useGridAspectRatio();

  const admittedParticipants = useAdmittedParticipants(participants, localParticipant?.identity);
  const count = admittedParticipants.length;
  const isSingleParticipant = count === 1;
  
  // Determine if aspect ratio is landscape (width > height)
  const isLandscape = aspectRatio === '16:9' || aspectRatio === '4:3';

  // Single participant: use flexbox centering with aspect ratio
  if (isSingleParticipant) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="relative rounded-lg bg-surface-900"
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
            className="w-full h-full rounded-lg" 
            isSpeakerTile={true}
          />
        </div>
      </div>
    );
  }

  // Calculate grid dimensions
  const { cols, rows } = getGridDimensions(count, aspectRatio);
  const useFixedGrid = count <= FIXED_GRID_MAX;
  const needsScroll = count > SCROLL_THRESHOLD;

  // Use fixed grid with calculated dimensions
  // - 2-8: fixed grid dimensions, fills space, no scroll
  // - 9-32: responsive formula, fills space, no scroll
  // - 33+: responsive formula, may scroll if content exceeds viewport
  return (
    <div
      className={`w-full h-full p-2 ${needsScroll ? 'overflow-y-auto' : 'overflow-hidden'}`}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        alignContent: useFixedGrid ? 'center' : 'start',
        gap: '8px',
        // Scrollbar styling for 33+
        ...(needsScroll ? {
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.3) transparent',
        } : {}),
      }}
    >
      {admittedParticipants.map((p) => (
        <div
          key={p.identity}
          className="relative rounded-lg bg-surface-900"
        >
          <ParticipantTile participant={p} className="w-full h-full rounded-lg" isSpeakerTile={false} />
        </div>
      ))}
    </div>
  );
}
