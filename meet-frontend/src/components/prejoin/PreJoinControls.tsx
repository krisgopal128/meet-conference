import { Mic, MicOff, Settings, Video, VideoOff } from 'lucide-react';
import { cn } from '../../utils/cn';
import type { PreJoinControlsProps } from './types';

export function PreJoinControls({
  videoEnabled,
  audioEnabled,
  gridAspectRatio,
  onToggleVideo,
  onToggleAudio,
  onToggleSettings,
}: PreJoinControlsProps) {
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20 flex-row">
      <button
        onClick={onToggleVideo}
        aria-label={videoEnabled ? 'Turn camera off' : 'Turn camera on'}
        className={cn(
          'flex items-center justify-center rounded-lg text-sm font-medium transition shadow-lg whitespace-nowrap focus:ring-2 focus:ring-brand-500 focus:outline-none',
          gridAspectRatio === '9:16' ? 'p-2.5' : 'px-4 py-2.5 gap-2',
          videoEnabled
            ? 'bg-white/90 text-surface-800 hover:bg-white'
            : 'bg-danger-500 text-white hover:bg-danger-600'
        )}
      >
        {videoEnabled ? <Video size={18} /> : <VideoOff size={18} />}
        <span className={cn(gridAspectRatio === '9:16' ? 'hidden' : 'hidden sm:inline')}>
          {videoEnabled ? 'Camera On' : 'Camera Off'}
        </span>
      </button>
      <button
        onClick={onToggleAudio}
        aria-label={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        className={cn(
          'flex items-center justify-center rounded-lg text-sm font-medium transition shadow-lg whitespace-nowrap focus:ring-2 focus:ring-brand-500 focus:outline-none',
          gridAspectRatio === '9:16' ? 'p-2.5' : 'px-4 py-2.5 gap-2',
          audioEnabled
            ? 'bg-white/90 text-surface-800 hover:bg-white'
            : 'bg-danger-500 text-white hover:bg-danger-600'
        )}
      >
        {audioEnabled ? <Mic size={18} /> : <MicOff size={18} />}
        <span className={cn(gridAspectRatio === '9:16' ? 'hidden' : 'hidden sm:inline')}>
          {audioEnabled ? 'Mic On' : 'Mic Off'}
        </span>
      </button>
      <button
        onClick={onToggleSettings}
        aria-label="Device settings"
        className={cn(
          'flex items-center justify-center rounded-lg text-sm font-medium bg-white/90 text-surface-800 hover:bg-white transition shadow-lg whitespace-nowrap focus:ring-2 focus:ring-brand-500 focus:outline-none',
          gridAspectRatio === '9:16' ? 'p-2.5' : 'px-4 py-2.5 gap-2'
        )}
      >
        <Settings size={18} />
        <span className={cn(gridAspectRatio === '9:16' ? 'hidden' : 'hidden sm:inline')}>Settings</span>
      </button>
    </div>
  );
}
