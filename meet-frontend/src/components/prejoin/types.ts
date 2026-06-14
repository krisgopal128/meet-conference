import type { GridAspectRatio, VideoFitMode, BackgroundMode } from '../../store/roomStore';

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
  backgroundBlur: boolean;
  backgroundBlurLevel: number;
  backgroundMode: BackgroundMode;
  backgroundBgColor: string;
  backgroundImagePath: string | null;
  mirrorCamera: boolean;
  isGuest: boolean;
  onAspectRatioChange: (ratio: GridAspectRatio) => void;
  onVideoFitModeChange: (mode: VideoFitMode) => void;
  onVideoFilterChange: (filter: 'none' | 'lightweight') => void;
  onBackgroundBlurChange: (enabled: boolean) => void;
  onBackgroundBlurLevelChange: (level: number) => void;
  onBackgroundModeChange: (mode: BackgroundMode) => void;
  onBackgroundBgColorChange: (color: string) => void;
  onBackgroundImagePathChange: (path: string | null) => void;
  onMirrorCameraChange: (enabled: boolean) => void;
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
