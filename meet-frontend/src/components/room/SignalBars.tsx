import { memo } from 'react';
import { ConnectionQuality } from 'livekit-client';

interface SignalBarsProps {
  quality: ConnectionQuality;
  /** Smaller variant for tight spaces like list rows */
  compact?: boolean;
}

const BAR_WIDTHS = {
  full: 'w-[3px]',
  compact: 'w-[2px]',
};

const HEIGHTS = {
  full: 'h-3',
  compact: 'h-2.5',
};

function getBarHeights(quality: ConnectionQuality): string[] {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return ['25%', '50%', '75%', '100%'];
    case ConnectionQuality.Good:
      return ['25%', '50%', '75%', '0%'];
    case ConnectionQuality.Poor:
      return ['25%', '50%', '0%', '0%'];
    case ConnectionQuality.Lost:
    default:
      return ['25%', '0%', '0%', '0%'];
  }
}

function getColor(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'bg-green-500';
    case ConnectionQuality.Good:
      return 'bg-yellow-500';
    case ConnectionQuality.Poor:
      return 'bg-orange-500';
    case ConnectionQuality.Lost:
    default:
      return 'bg-red-500';
  }
}

function getLabel(quality: ConnectionQuality): string {
  switch (quality) {
    case ConnectionQuality.Excellent:
      return 'Excellent';
    case ConnectionQuality.Good:
      return 'Good';
    case ConnectionQuality.Poor:
      return 'Poor';
    case ConnectionQuality.Lost:
    default:
      return 'Connection Lost';
  }
}

/**
 * Signal strength bars indicator (4 bars, fills based on connection quality).
 * Used in both video tiles and participant list rows.
 */
export const SignalBars = memo(function SignalBars({ quality, compact = false }: SignalBarsProps) {
  const heights = getBarHeights(quality);
  const color = getColor(quality);
  const barWidth = compact ? BAR_WIDTHS.compact : BAR_WIDTHS.full;
  const containerHeight = compact ? HEIGHTS.compact : HEIGHTS.full;

  return (
    <div
      className={`flex items-end gap-[2px] ${containerHeight}`}
      title={`Connection: ${getLabel(quality)}`}
      role="img"
      aria-label={`Connection quality: ${getLabel(quality)}`}
    >
      {heights.map((h, i) => (
        <div
          key={i}
          className={`${barWidth} ${h !== '0%' ? color : 'bg-white/30'} rounded-[1px]`}
          style={{ height: h }}
        />
      ))}
    </div>
  );
});

export default SignalBars;
