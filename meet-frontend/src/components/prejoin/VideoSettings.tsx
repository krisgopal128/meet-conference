import { Crop, Grid3X3, Maximize2 } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { VideoSettingsProps } from './types';

export function VideoSettings({
  gridAspectRatio,
  videoFitMode,
  videoFilter,
  isGuest,
  onAspectRatioChange,
  onVideoFitModeChange,
  onVideoFilterChange,
  isExpanded,
  onToggle,
}: VideoSettingsProps) {
  return (
    <div className="border-b border-surface-200 dark:border-surface-700 pb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <Crop size={14} />
          Video Settings
        </h3>
        <span className="text-xs text-surface-400">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Video Aspect Ratio - Available to ALL authenticated users (inside Video Settings) */}
          {!isGuest && (
            <div>
              <label className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400 mb-2">
                <Grid3X3 size={14} />
                Video Aspect Ratio
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['16:9', '9:16', '1:1', '4:3'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    type="button"
                    onClick={() => onAspectRatioChange(ratio)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium transition',
                      gridAspectRatio === ratio
                        ? 'bg-brand-500 text-white'
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                    )}
                  >
                    {ratio === '16:9'
                      ? '16:9 Widescreen'
                      : ratio === '9:16'
                        ? '9:16 Portrait'
                        : ratio === '1:1'
                          ? '1:1 Square'
                          : '4:3 Standard'}
                  </button>
                ))}
              </div>
              <p className="text-xs text-surface-400 mt-1">Sets video preview shape and tile size in meeting</p>
            </div>
          )}

          {/* Video Fit Mode - Available to all */}
          <div>
            <label className="flex items-center gap-2 text-xs text-surface-500 dark:text-surface-400 mb-2">
              <Crop size={14} />
              Video Fit Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onVideoFitModeChange('cover')}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition',
                  videoFitMode === 'cover'
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                )}
              >
                <Crop size={14} />
                <span>Crop (Fill)</span>
              </button>
              <button
                type="button"
                onClick={() => onVideoFitModeChange('contain')}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition',
                  videoFitMode === 'contain'
                    ? 'bg-brand-500 text-white'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                )}
              >
                <Maximize2 size={14} />
                <span>Fit (Letterbox)</span>
              </button>
            </div>
            <p className="text-xs text-surface-400 mt-1">
              {videoFitMode === 'cover'
                ? 'Crops video to fill frame (may cut edges)'
                : 'Shows full video with black bars if needed'}
            </p>
          </div>

          {/* Video filter - Available to ALL users (personal preference) */}
          <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200 flex items-center gap-2">
                Video filter
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                  Personal
                </span>
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Reduces rolling shutter artifacts</p>
            </div>
            <select
              value={videoFilter}
              onChange={(e) => onVideoFilterChange(e.target.value as 'none' | 'lightweight')}
              className="text-sm bg-surface-100 dark:bg-surface-700 border-0 rounded px-2 py-1"
            >
              <option value="lightweight">Lightweight</option>
              <option value="none">None</option>
            </select>
          </label>
        </div>
      )}
    </div>
  );
}
