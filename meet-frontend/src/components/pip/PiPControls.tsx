/**
 * PiPControls - Control buttons for Picture-in-Picture window
 *
 * Provides essential controls for the PiP window:
 * - Mute/unmute microphone
 * - Camera toggle
 * - Screen share toggle
 * - Return to main tab
 * - Hang up/leave
 */

import { memo, useCallback } from 'react';
import { LocalParticipant } from 'livekit-client';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Monitor,
  MonitorOff,
  PictureInPicture2,
  PhoneOff,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface PiPControlsProps {
  onReturnToTab: () => void;
  localParticipant: LocalParticipant | null;
}

// Button style presets for PiP
const pipBtnBase = 'pip-button flex items-center justify-center p-2 rounded-lg transition-all duration-150 min-w-[40px] min-h-[40px]';
const pipBtnPrimary = 'bg-surface-700 hover:bg-surface-600 text-white';
const pipBtnOff = 'bg-danger-500 hover:bg-danger-600 text-white';
const pipBtnSuccess = 'bg-success-500 hover:bg-success-600 text-white';
const pipBtnSecondary = 'bg-surface-700/60 hover:bg-surface-600 text-surface-200';
const pipBtnAccent = 'bg-brand-500 hover:bg-brand-600 text-white';

// Memoized button components to prevent unnecessary re-renders

interface MicControlProps {
  isMuted: boolean;
  onToggle: () => void;
}

const MicControl = memo(function MicControl({ isMuted, onToggle }: MicControlProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      className={cn(pipBtnBase, isMuted ? pipBtnOff : pipBtnPrimary)}
      title={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
});

interface CameraControlProps {
  isOff: boolean;
  onToggle: () => void;
}

const CameraControl = memo(function CameraControl({ isOff, onToggle }: CameraControlProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isOff ? 'Turn on camera' : 'Turn off camera'}
      className={cn(pipBtnBase, isOff ? pipBtnOff : pipBtnPrimary)}
      title={isOff ? 'Start Camera' : 'Stop Camera'}
    >
      {isOff ? <VideoOff size={18} /> : <Video size={18} />}
    </button>
  );
});

interface ScreenShareControlProps {
  isSharing: boolean;
  onToggle: () => void;
}

const ScreenShareControl = memo(function ScreenShareControl({ isSharing, onToggle }: ScreenShareControlProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isSharing ? 'Stop screen share' : 'Share screen'}
      className={cn(pipBtnBase, isSharing ? pipBtnSuccess : pipBtnSecondary)}
      title={isSharing ? 'Stop Share' : 'Share Screen'}
    >
      {isSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
    </button>
  );
});

interface ReturnButtonProps {
  onClick: () => void;
}

const ReturnButton = memo(function ReturnButton({ onClick }: ReturnButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Return to main tab"
      className={cn(pipBtnBase, pipBtnAccent)}
      title="Return to Tab"
    >
      <PictureInPicture2 size={18} />
    </button>
  );
});

interface HangUpButtonProps {
  onClick: () => void;
}

const HangUpButton = memo(function HangUpButton({ onClick }: HangUpButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label="Leave meeting"
      className={cn(pipBtnBase, pipBtnOff)}
      title="Leave"
    >
      <PhoneOff size={18} />
    </button>
  );
});

export function PiPControls({ onReturnToTab, localParticipant }: PiPControlsProps) {
  // Derived state
  const isMicMuted = !localParticipant?.isMicrophoneEnabled;
  const isCameraOff = !localParticipant?.isCameraEnabled;
  const isScreenSharing = localParticipant?.isScreenShareEnabled ?? false;

  // Toggle handlers
  const toggleMic = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled);
    } catch (error) {
      console.error('[PiPControls] Failed to toggle microphone:', error);
    }
  }, [localParticipant]);

  const toggleCamera = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled);
    } catch (error) {
      console.error('[PiPControls] Failed to toggle camera:', error);
    }
  }, [localParticipant]);

  const toggleScreenShare = useCallback(async () => {
    if (!localParticipant) return;
    try {
      await localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled);
    } catch (error) {
      console.error('[PiPControls] Failed to toggle screen share:', error);
    }
  }, [localParticipant]);

  // Leave meeting handler - navigates back to main tab first
  const handleHangUp = useCallback(async () => {
    if (!localParticipant) return;

    // Stop all tracks
    try {
      if (localParticipant.isScreenShareEnabled) {
        await localParticipant.setScreenShareEnabled(false);
      }
      if (localParticipant.isCameraEnabled) {
        await localParticipant.setCameraEnabled(false);
      }
      if (localParticipant.isMicrophoneEnabled) {
        await localParticipant.setMicrophoneEnabled(false);
      }
    } catch (error) {
      console.error('[PiPControls] Failed to stop tracks:', error);
    }

    // Return to main tab (which will handle disconnect)
    onReturnToTab();
  }, [localParticipant, onReturnToTab]);

  return (
    <div className="pip-controls flex items-center justify-center gap-2 p-2 bg-surface-800 border-t border-surface-700">
      <MicControl isMuted={isMicMuted} onToggle={toggleMic} />
      <CameraControl isOff={isCameraOff} onToggle={toggleCamera} />
      <ScreenShareControl isSharing={isScreenSharing} onToggle={toggleScreenShare} />

      <div className="w-px h-6 bg-surface-600 mx-1" />

      <ReturnButton onClick={onReturnToTab} />
      <HangUpButton onClick={handleHangUp} />
    </div>
  );
}
