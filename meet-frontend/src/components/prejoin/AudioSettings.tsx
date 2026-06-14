import { ChevronDown, ChevronRight, Mic } from 'lucide-react';
import type { AudioSettingsProps } from './types';

export function AudioSettings({
  noiseSuppression,
  echoCancellation,
  onNoiseSuppressionChange,
  onEchoCancellationChange,
  isExpanded,
  onToggle,
}: AudioSettingsProps) {
  return (
    <div className="border-b border-surface-200 dark:border-surface-700 pb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <Mic size={14} />
          Audio Settings
        </h3>
        <span className="text-xs text-surface-400">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</span>
      </button>
      {isExpanded && (
        <div className="mt-3 space-y-2">
          <p className="text-[10px] text-surface-400 mb-1">Audio settings apply when you join the meeting</p>
          <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Noise suppression</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Reduces background noise</p>
            </div>
            <input
              type="checkbox"
              checked={noiseSuppression}
              onChange={(e) => onNoiseSuppressionChange(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
          <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Echo cancellation</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Prevents audio feedback</p>
            </div>
            <input
              type="checkbox"
              checked={echoCancellation}
              onChange={(e) => onEchoCancellationChange(e.target.checked)}
              className="h-4 w-4 rounded border-surface-300 text-brand-500 focus:ring-brand-500"
            />
          </label>
        </div>
      )}
    </div>
  );
}
