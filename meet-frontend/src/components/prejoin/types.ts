import type { GridAspectRatio, VideoFitMode } from '../../store/roomStore';

export interface DeviceList {
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export interface DeviceSettingsProps {
  devices: DeviceList;
  selectedCamera: string;
  selectedMic: string;
  selectedSpeaker: string;
  micLevel: number;
  speakerLevel: number;
  onCameraChange: (deviceId: string) => void;
  onMicChange: (deviceId: string) => void;
  onSpeakerChange: (deviceId: string) => void;
  onMicLevelChange: (level: number) => void;
  onSpeakerLevelChange: (level: number) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface AudioSettingsProps {
  noiseSuppression: boolean;
  echoCancellation: boolean;
  onNoiseSuppressionChange: (enabled: boolean) => void;
  onEchoCancellationChange: (enabled: boolean) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface VideoSettingsProps {
  gridAspectRatio: GridAspectRatio;
  videoFitMode: VideoFitMode;
  videoFilter: 'none' | 'lightweight';
  isGuest: boolean;
  onAspectRatioChange: (ratio: GridAspectRatio) => void;
  onVideoFitModeChange: (mode: VideoFitMode) => void;
  onVideoFilterChange: (filter: 'none' | 'lightweight') => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export interface PreJoinControlsProps {
  videoEnabled: boolean;
  audioEnabled: boolean;
  gridAspectRatio: GridAspectRatio;
  onToggleVideo: () => void;
  onToggleAudio: () => void;
  onToggleSettings: () => void;
}
