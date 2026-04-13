import { Video } from 'lucide-react';
import type { DeviceSettingsProps } from './types';

export function DeviceSettings({
  devices,
  selectedCamera,
  selectedMic,
  selectedSpeaker,
  micLevel,
  speakerLevel,
  onCameraChange,
  onMicChange,
  onSpeakerChange,
  onMicLevelChange,
  onSpeakerLevelChange,
  isExpanded,
  onToggle,
}: DeviceSettingsProps) {
  return (
    <div className="border-b border-surface-200 dark:border-surface-700 pb-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-semibold text-surface-700 dark:text-surface-300 flex items-center gap-2">
          <Video size={14} />
          Devices
        </h3>
        <span className="text-xs text-surface-400">{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">Camera</label>
            <select
              value={selectedCamera}
              onChange={(e) => onCameraChange(e.target.value)}
              className="text-sm"
            >
              <option value="">Default Camera</option>
              {devices.cameras.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Camera'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">Microphone</label>
            <select
              value={selectedMic}
              onChange={(e) => onMicChange(e.target.value)}
              className="text-sm"
            >
              <option value="">Default Microphone</option>
              {devices.mics.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Microphone'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">
              Mic Level: {micLevel}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={micLevel}
              onChange={(e) => onMicLevelChange(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
          <div>
            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">Speaker</label>
            <select
              value={selectedSpeaker}
              onChange={(e) => onSpeakerChange(e.target.value)}
              className="text-sm"
            >
              <option value="">Default Speaker</option>
              {devices.speakers.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || 'Speaker'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-surface-500 dark:text-surface-400 mb-1 block">
              Speaker Level: {speakerLevel}
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={speakerLevel}
              onChange={(e) => onSpeakerLevelChange(Number(e.target.value))}
              className="w-full accent-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}
