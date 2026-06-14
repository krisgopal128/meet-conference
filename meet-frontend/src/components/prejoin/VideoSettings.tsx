import { useRef, type ChangeEvent } from 'react';
import { Crop, Grid3X3, Maximize2, Eye, FlipHorizontal, Palette, Image as ImageIcon, Upload } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { VideoSettingsProps } from './types';

export function VideoSettings({
  gridAspectRatio,
  videoFitMode,
  videoFilter,
  backgroundBlur,
  backgroundBlurLevel,
  backgroundMode,
  backgroundBgColor,
  backgroundImagePath,
  mirrorCamera,
  isGuest,
  onAspectRatioChange,
  onVideoFitModeChange,
  onVideoFilterChange,
  onBackgroundBlurChange,
  onBackgroundBlurLevelChange,
  onBackgroundModeChange,
  onBackgroundBgColorChange,
  onBackgroundImagePathChange,
  onMirrorCameraChange,
  isExpanded,
  onToggle,
}: VideoSettingsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      onBackgroundImagePathChange(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

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
          {/* Video Aspect Ratio */}
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

          {/* Video Fit Mode */}
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

          {/* Mirror Camera */}
          <button
            type="button"
            onClick={() => onMirrorCameraChange(!mirrorCamera)}
            className="w-full flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5 transition hover:bg-surface-50 dark:hover:bg-surface-700/50"
          >
            <div className="flex items-center gap-2">
              <FlipHorizontal size={14} className="text-surface-500 dark:text-surface-400" />
              <div className="text-left">
                <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Mirror Camera</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Flip video horizontally (selfie view)</p>
              </div>
            </div>
            <span className={cn('text-xs font-medium', mirrorCamera ? 'text-brand-500' : 'text-surface-400')}>
              {mirrorCamera ? 'On' : 'Off'}
            </span>
          </button>

          {/* Video filter */}
          <label className="flex items-center justify-between rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Video filter</p>
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

          {/* Background Effect */}
          <div className="rounded-lg border border-surface-200 dark:border-surface-700 px-3 py-2.5 space-y-3">
            {/* Master toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-surface-500 dark:text-surface-400" />
                <div>
                  <p className="text-sm font-medium text-surface-700 dark:text-surface-200">Background Effect</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Modify your camera background</p>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={backgroundBlur}
                onClick={() => onBackgroundBlurChange(!backgroundBlur)}
                className={cn(
                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                  backgroundBlur ? 'bg-brand-500' : 'bg-surface-300 dark:bg-surface-600'
                )}
              >
                <span className={cn(
                  'inline-block h-4 w-4 rounded-full bg-white transition-transform',
                  backgroundBlur ? 'translate-x-6' : 'translate-x-1'
                )} />
              </button>
            </div>

            {/* Mode selector + contextual controls */}
            {backgroundBlur && (
              <div className="space-y-3 pt-1">
                {/* Mode buttons */}
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { mode: 'blur' as const, label: 'Blur', icon: Eye },
                    { mode: 'color' as const, label: 'Color', icon: Palette },
                    { mode: 'image' as const, label: 'Image', icon: ImageIcon },
                    { mode: 'none' as const, label: 'None', icon: Crop },
                  ]).map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onBackgroundModeChange(mode)}
                      className={cn(
                        'flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-xs font-medium transition',
                        backgroundMode === mode
                          ? 'bg-brand-500 text-white'
                          : 'bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-600'
                      )}
                    >
                      <Icon size={14} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* Blur intensity slider */}
                {backgroundMode === 'blur' && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
                      <span>Blur intensity</span>
                      <span>{backgroundBlurLevel}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={backgroundBlurLevel}
                      onChange={(e) => onBackgroundBlurLevelChange(Number(e.target.value))}
                      className="mt-2 w-full accent-brand-500"
                    />
                  </div>
                )}

                {/* Color picker */}
                {backgroundMode === 'color' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={backgroundBgColor}
                      onChange={(e) => onBackgroundBgColorChange(e.target.value)}
                      className="h-9 w-12 rounded-lg border border-surface-300 dark:border-surface-600 bg-transparent cursor-pointer"
                    />
                    <div>
                      <p className="text-xs font-medium text-surface-700 dark:text-surface-200">Solid Color</p>
                      <p className="text-xs text-surface-400 font-mono">{backgroundBgColor}</p>
                    </div>
                  </div>
                )}

                {/* Image URL input + file upload */}
                {backgroundMode === 'image' && (
                  <div>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-1.5">Background image</p>
                    <input
                      type="url"
                      value={backgroundImagePath?.startsWith('data:') ? '' : (backgroundImagePath ?? '')}
                      onChange={(e) => onBackgroundImagePathChange(e.target.value || null)}
                      placeholder="https://example.com/bg.jpg"
                      className="w-full rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 px-3 py-2 text-sm text-surface-700 dark:text-surface-100 placeholder-surface-400 focus:border-brand-500 focus:outline-none"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-surface-300 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-700 dark:text-surface-100 hover:bg-surface-100 dark:hover:bg-surface-600 focus:outline-none"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload from device
                      </button>
                      {backgroundImagePath?.startsWith('data:') && (
                        <span className="text-xs text-success-600 dark:text-success-400">✓ Image loaded</span>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {/* None — passthrough */}
                {backgroundMode === 'none' && (
                  <p className="text-xs text-surface-400">Raw camera feed — no background processing</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
