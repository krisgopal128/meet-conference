/**
 * Memoized ControlBar Button Components
 * 
 * Split from ControlBar to prevent re-renders when unrelated state changes.
 * Each button only subscribes to the specific state it needs.
 */

import { memo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MessageSquare, Users,
  PhoneOff, LayoutGrid, Hand, Circle, MoreVertical, LogOut,
  StopCircle, ChevronDown,
  SquarePlay, Lock, Unlock, DoorOpen, ScreenShare, MessageCircle, Mic as MicIcon, Camera,
  CircleDot, Loader2, Pencil,
  Link2, Bell, BellOff, FlipHorizontal, Activity, Sparkles,
  PictureInPicture2,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';

// ============================================
// Constants
// ============================================

const MAX_BADGE_COUNT = 9;

// ============================================
// Button Style Presets
// ============================================

const btnBase = 'flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-150 min-w-[64px] min-h-[52px]';
const btnPrimary = 'bg-surface-700 hover:bg-surface-600 text-white shadow-sm';
const btnPrimaryOff = 'bg-danger-500 hover:bg-danger-600 text-white shadow-sm';
const btnSecondary = 'bg-surface-700/60 hover:bg-surface-600 text-surface-200';
const btnAccent = 'bg-brand-500 hover:bg-brand-600 text-white shadow-sm';
const btnSuccess = 'bg-success-500 hover:bg-success-600 text-white shadow-sm';
const btnWarning = 'bg-warning-500 hover:bg-warning-600 text-surface-900 shadow-sm';

const btnMobile = 'flex items-center justify-center p-2 rounded-xl text-xs font-medium transition-all min-w-[44px] min-h-[44px]';
const btnMobilePrimary = 'bg-surface-700 hover:bg-surface-600 text-white';
const btnMobileOff = 'bg-danger-500 hover:bg-danger-600 text-white';
const btnMobileSecondary = 'bg-surface-700/60 hover:bg-surface-600 text-surface-300';

// ============================================
// Generic Device Menu Component
// ============================================

interface DeviceMenuItem {
  deviceId: string;
  label: string;
}

interface GenericDeviceMenuProps {
  show: boolean;
  onClose: () => void;
  sections: Array<{
    title: string;
    items: DeviceMenuItem[];
    activeId: string;
    onSelect: (id: string) => void;
    defaultLabel: string;
  }>;
}

const GenericDeviceMenu = memo(function GenericDeviceMenu({
  show,
  onClose,
  sections,
}: GenericDeviceMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div ref={menuRef} className="absolute bottom-full left-0 mb-2 min-w-[220px] rounded-xl border border-surface-600 bg-surface-700 py-1 shadow-lg z-50">
      {sections.map((section, sectionIdx) => (
        <div key={section.title}>
          {sectionIdx > 0 && <div className="my-1 border-t border-surface-600" />}
          <div className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-surface-400">
            {section.title}
          </div>
          <button
            onClick={() => { section.onSelect(''); }}
            className={cn(
              'w-full px-4 py-2 text-left text-sm hover:bg-surface-600',
              section.activeId === '' ? 'text-brand-300' : 'text-white'
            )}
          >
            {section.defaultLabel}
          </button>
          {section.items.map((device) => (
            <button
              key={device.deviceId}
              onClick={() => { section.onSelect(device.deviceId); }}
              className={cn(
                'w-full px-4 py-2 text-left text-sm hover:bg-surface-600',
                section.activeId === device.deviceId ? 'text-brand-300' : 'text-white'
              )}
            >
              {device.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
});

// ============================================
// Device Menu Component (uses generic)
// ============================================

interface DeviceMenuComponentProps {
  show: boolean;
  onClose: () => void;
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  activeMicId: string;
  activeSpeakerId: string;
  onSwitchMic: (id: string) => void;
  onSwitchSpeaker: (id: string) => void;
  showSpeakers?: boolean;
}

const DeviceMenuComponent = memo(function DeviceMenuComponent({
  show,
  onClose,
  mics,
  speakers,
  activeMicId,
  activeSpeakerId,
  onSwitchMic,
  onSwitchSpeaker,
  showSpeakers = true,
}: DeviceMenuComponentProps) {
  const sections = [
    {
      title: 'Microphone',
      items: mics.map(d => ({ deviceId: d.deviceId, label: d.label || 'Microphone' })),
      activeId: activeMicId,
      onSelect: onSwitchMic,
      defaultLabel: 'Default Microphone',
    },
    ...(showSpeakers ? [{
      title: 'Speaker',
      items: speakers.map(d => ({ deviceId: d.deviceId, label: d.label || 'Speaker' })),
      activeId: activeSpeakerId,
      onSelect: onSwitchSpeaker,
      defaultLabel: 'Default Speaker',
    }] : []),
  ];

  return <GenericDeviceMenu show={show} onClose={onClose} sections={sections} />;
});

// ============================================
// Camera Menu Component (uses generic)
// ============================================

interface CameraMenuComponentProps {
  show: boolean;
  onClose: () => void;
  cameras: MediaDeviceInfo[];
  activeCameraId: string;
  onSwitchCamera: (id: string) => void;
}

const CameraMenuComponent = memo(function CameraMenuComponent({
  show,
  onClose,
  cameras,
  activeCameraId,
  onSwitchCamera,
}: CameraMenuComponentProps) {
  const sections = [{
    title: 'Camera',
    items: cameras.map(d => ({ deviceId: d.deviceId, label: d.label || 'Camera' })),
    activeId: activeCameraId,
    onSelect: onSwitchCamera,
    defaultLabel: 'Default Camera',
  }];

  return <GenericDeviceMenu show={show} onClose={onClose} sections={sections} />;
});

// ============================================
// Mic Button
// ============================================

interface MicButtonProps {
  isMuted: boolean;
  onToggle: () => void;
  showDeviceMenu?: boolean;
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
  activeMicId: string;
  activeSpeakerId: string;
  onSwitchMic: (id: string) => void;
  onSwitchSpeaker: (id: string) => void;
}

export const MicButton = memo(function MicButton({
  isMuted,
  onToggle,
  showDeviceMenu = false,
  mics,
  speakers,
  activeMicId,
  activeSpeakerId,
  onSwitchMic,
  onSwitchSpeaker,
}: MicButtonProps) {
  const [showDevices, setShowDevices] = useState(false);

  return (
    <div className="relative flex">
      <button
        onClick={onToggle}
        aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
        className={cn(
          btnBase,
          isMuted ? btnPrimaryOff : btnPrimary,
          showDeviceMenu && 'rounded-r-none border-r border-black/10'
        )}
      >
        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
        <span>{isMuted ? 'Unmute' : 'Mute'}</span>
      </button>
      {showDeviceMenu && (
        <>
          <button
            onClick={() => setShowDevices(!showDevices)}
            aria-label="Select microphone"
            className={cn(
              isMuted ? btnPrimaryOff : btnPrimary,
              'px-2 rounded-r-xl rounded-l-none flex items-center justify-center'
            )}
          >
            <ChevronDown size={16} />
          </button>
          <DeviceMenuComponent
            show={showDevices}
            onClose={() => setShowDevices(false)}
            mics={mics}
            speakers={speakers}
            activeMicId={activeMicId}
            activeSpeakerId={activeSpeakerId}
            onSwitchMic={onSwitchMic}
            onSwitchSpeaker={onSwitchSpeaker}
          />
        </>
      )}
    </div>
  );
});

// ============================================
// Camera Button
// ============================================

interface CameraButtonProps {
  isOff: boolean;
  onToggle: () => void;
  showDeviceMenu?: boolean;
  cameras: MediaDeviceInfo[];
  activeCameraId: string;
  onSwitchCamera: (id: string) => void;
}

export const CameraButton = memo(function CameraButton({
  isOff,
  onToggle,
  showDeviceMenu = false,
  cameras,
  activeCameraId,
  onSwitchCamera,
}: CameraButtonProps) {
  const [showDevices, setShowDevices] = useState(false);

  return (
    <div className="relative flex">
      <button
        onClick={onToggle}
        aria-label={isOff ? 'Turn on camera' : 'Turn off camera'}
        className={cn(
          btnBase,
          isOff ? btnPrimaryOff : btnPrimary,
          showDeviceMenu && 'rounded-r-none border-r border-black/10'
        )}
      >
        {isOff ? <VideoOff size={20} /> : <Video size={20} />}
        <span>{isOff ? 'Start' : 'Stop'}</span>
      </button>
      {showDeviceMenu && (
        <>
          <button
            onClick={() => setShowDevices(!showDevices)}
            aria-label="Select camera"
            className={cn(
              isOff ? btnPrimaryOff : btnPrimary,
              'px-2 rounded-r-xl rounded-l-none flex items-center justify-center'
            )}
          >
            <ChevronDown size={16} />
          </button>
          <CameraMenuComponent
            show={showDevices}
            onClose={() => setShowDevices(false)}
            cameras={cameras}
            activeCameraId={activeCameraId}
            onSwitchCamera={onSwitchCamera}
          />
        </>
      )}
    </div>
  );
});

// ============================================
// Screen Share Button
// ============================================

interface ScreenShareButtonProps {
  isSharing: boolean;
  onToggle: () => void;
}

export const ScreenShareButton = memo(function ScreenShareButton({
  isSharing,
  onToggle,
}: ScreenShareButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isSharing ? 'Stop screen share' : 'Share screen'}
      className={cn(btnBase, isSharing ? btnSuccess : btnSecondary)}
    >
      {isSharing ? <StopCircle size={20} /> : <Monitor size={20} />}
      <span>{isSharing ? 'Stop' : 'Share'}</span>
    </button>
  );
});

// ============================================
// Hand Button
// ============================================

interface HandButtonProps {
  isRaised: boolean;
  onToggle: () => void;
}

export const HandButton = memo(function HandButton({
  isRaised,
  onToggle,
}: HandButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isRaised ? 'Lower hand' : 'Raise hand'}
      className={cn(btnBase, isRaised ? btnWarning : btnSecondary)}
    >
      <Hand size={18} />
      <span>{isRaised ? 'Lower' : 'Hand'}</span>
    </button>
  );
});

// ============================================
// Layout Button
// ============================================

type LayoutMode = 'grid' | 'speaker' | 'spotlight' | 'screenshare' | 'whiteboard';

interface LayoutButtonProps {
  layout: LayoutMode;
  onToggle: () => void;
}

export const LayoutButton = memo(function LayoutButton({
  layout,
  onToggle,
}: LayoutButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch to ${layout === 'grid' ? 'speaker' : 'grid'} layout`}
      className={btnBase + ' ' + btnSecondary}
    >
      {layout === 'grid' ? <SquarePlay size={18} /> : <LayoutGrid size={18} />}
      <span>{layout === 'grid' ? 'Speaker' : 'Grid'}</span>
    </button>
  );
});

// ============================================
// PiP Button
// ============================================

interface PiPButtonProps {
  isActive: boolean;
  isSupported: boolean;
  onToggle: () => void;
}

export const PiPButton = memo(function PiPButton({
  isActive,
  isSupported,
  onToggle,
}: PiPButtonProps) {
  if (!isSupported) return null;
  return (
    <button
      onClick={onToggle}
      aria-label={isActive ? 'Exit picture-in-picture' : 'Enter picture-in-picture'}
      className={cn(btnBase, isActive ? btnAccent : btnSecondary)}
    >
      <PictureInPicture2 size={18} />
      <span>{isActive ? 'PiP On' : 'PiP'}</span>
    </button>
  );
});

// ============================================
// Chat Button
// ============================================

interface ChatButtonProps {
  isOpen: boolean;
  unreadCount: number;
  mentionCount?: number;
  onToggle: () => void;
}

export const ChatButton = memo(function ChatButton({
  isOpen,
  unreadCount,
  mentionCount = 0,
  onToggle,
}: ChatButtonProps) {
  const showMentionBadge = mentionCount > 0 && !isOpen;
  const showUnreadBadge = unreadCount > 0 && !showMentionBadge;
  
  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
      className={cn(btnBase, isOpen ? btnAccent : btnSecondary, 'relative')}
    >
      <MessageSquare size={18} />
      <span>Chat</span>
      {/* Mention badge - takes priority */}
      {showMentionBadge && (
        <span className="absolute -top-1 -right-1 bg-brand-500 text-white text-[10px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold shadow-sm">
          @{mentionCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : mentionCount}
        </span>
      )}
      {/* Unread badge - only shown when no mentions */}
      {showUnreadBadge && (
        <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm">
          {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
        </span>
      )}
    </button>
  );
});

// ============================================
// Whiteboard Button
// ============================================

interface WhiteboardButtonProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const WhiteboardButton = memo(function WhiteboardButton({
  isOpen,
  onToggle,
}: WhiteboardButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? 'Close whiteboard' : 'Open whiteboard'}
      className={cn(btnBase, isOpen ? btnAccent : btnSecondary)}
    >
      <Pencil size={18} />
      <span>Board</span>
    </button>
  );
});

// ============================================
// Participants Button
// ============================================

interface ParticipantsButtonProps {
  isOpen: boolean;
  lobbyCount: number;
  isModerator: boolean;
  onToggle: () => void;
}

export const ParticipantsButton = memo(function ParticipantsButton({
  isOpen,
  lobbyCount,
  isModerator,
  onToggle,
}: ParticipantsButtonProps) {
  return (
    <button
      onClick={onToggle}
      aria-label={isOpen ? 'Close participants' : 'Open participants'}
      className={cn(btnBase, isOpen ? btnAccent : btnSecondary, 'relative')}
    >
      <Users size={18} />
      <span>People</span>
      {isModerator && lobbyCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-warning-500 text-surface-900 text-[10px] min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center font-bold shadow-sm">
          +{lobbyCount}
        </span>
      )}
    </button>
  );
});

// ============================================
// Recording Button
// ============================================

interface RecordingButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export const RecordingButton = memo(function RecordingButton({
  isRecording,
  isLoading,
  onToggle,
}: RecordingButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isLoading}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      className={cn(
        btnBase,
        isRecording ? 'bg-danger-500 hover:bg-danger-600 text-white shadow-sm' : btnSecondary,
        isLoading && 'opacity-70 cursor-wait'
      )}
    >
      {isLoading ? (
        <Loader2 size={18} className="animate-spin" />
      ) : isRecording ? (
        <CircleDot size={18} className="animate-pulse" />
      ) : (
        <Circle size={18} />
      )}
      <span>{isLoading ? 'Please wait...' : isRecording ? 'Stop' : 'Record'}</span>
      {isRecording && !isLoading && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-danger-500"></span>
        </span>
      )}
    </button>
  );
});

// ============================================
// Recording Badge (for header)
// ============================================

interface RecordingBadgeProps {
  isRecording: boolean;
}

export const RecordingBadge = memo(function RecordingBadge({
  isRecording,
}: RecordingBadgeProps) {
  if (!isRecording) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-danger-500/20 border border-danger-500/30">
      <span className="relative flex h-2.5 w-2.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger-500"></span>
      </span>
      <span className="text-xs font-medium text-danger-300">Recording</span>
    </div>
  );
});

// ============================================
// Leave Confirm Dialog (shared)
// ============================================

function LeaveConfirmDialog({ open, onClose, onLeave, onEndMeeting }: {
  open: boolean;
  onClose: () => void;
  onLeave: () => void;
  onEndMeeting: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-surface-800 rounded-2xl border border-surface-600 p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-white mb-2">Leave Meeting?</h3>
        <p className="text-sm text-surface-400 mb-6">
          You are the host. Would you like to end the meeting for everyone or just leave?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-surface-700 hover:bg-surface-600 text-white text-sm font-medium transition"
          >
            Stay in Meeting
          </button>
          <button
            onClick={onLeave}
            className="w-full px-4 py-2.5 rounded-lg bg-warning-500 hover:bg-warning-600 text-surface-900 text-sm font-medium transition"
          >
            Just Leave (Meeting Continues)
          </button>
          <button
            onClick={onEndMeeting}
            className="w-full px-4 py-2.5 rounded-lg bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium transition"
          >
            End Meeting for Everyone
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Leave Button
// ============================================

interface LeaveButtonProps {
  onLeave: () => void;
  onEndMeeting?: () => void;
  isModerator?: boolean;
  hasOtherParticipants?: boolean;
}

export const LeaveButton = memo(function LeaveButton({
  onLeave,
  onEndMeeting,
  isModerator = false,
  hasOtherParticipants = false,
}: LeaveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    // Only show confirmation for moderators when there are other participants
    if (isModerator && hasOtherParticipants) {
      setShowConfirm(true);
    } else {
      // Non-moderators or solo moderators: just leave without confirmation
      onLeave();
    }
  };

  const handleEndMeeting = () => {
    setShowConfirm(false);
    if (onEndMeeting) {
      onEndMeeting();
    } else {
      onLeave();
    }
  };

  const handleJustLeave = () => {
    setShowConfirm(false);
    onLeave();
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label="Leave meeting"
        className="flex items-center gap-2 px-5 py-3 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium transition-all shadow-sm hover:shadow-md"
      >
        <PhoneOff size={18} aria-hidden="true" />
        <span>Leave</span>
      </button>

      {/* Confirmation Dialog - Rendered via portal at document root */}
      {createPortal(
        <LeaveConfirmDialog
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onLeave={handleJustLeave}
          onEndMeeting={handleEndMeeting}
        />,
        document.body,
      )}
    </>
  );
});

// ============================================
// Mobile Leave Button
// ============================================

export const MobileLeaveButton = memo(function MobileLeaveButton({
  onLeave,
  onEndMeeting,
  isModerator = false,
  hasOtherParticipants = false,
}: LeaveButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleClick = () => {
    // Only show confirmation for moderators when there are other participants
    if (isModerator && hasOtherParticipants) {
      setShowConfirm(true);
    } else {
      // Non-moderators or solo moderators: just leave without confirmation
      onLeave();
    }
  };

  const handleEndMeeting = () => {
    setShowConfirm(false);
    if (onEndMeeting) {
      onEndMeeting();
    } else {
      onLeave();
    }
  };

  const handleJustLeave = () => {
    setShowConfirm(false);
    onLeave();
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-semibold transition-all shadow-sm"
        aria-label="Leave meeting"
      >
        <LogOut size={18} aria-hidden="true" />
        <span>Leave</span>
      </button>

      {/* Confirmation Dialog - Rendered via portal at document root */}
      {createPortal(
        <LeaveConfirmDialog
          open={showConfirm}
          onClose={() => setShowConfirm(false)}
          onLeave={handleJustLeave}
          onEndMeeting={handleEndMeeting}
        />,
        document.body,
      )}
    </>
  );
});

// ============================================
// Mobile Button Variants
// ============================================

interface MobileMicButtonProps {
  isMuted: boolean;
  onToggle: () => void;
}

export const MobileMicButton = memo(function MobileMicButton({
  isMuted,
  onToggle,
}: MobileMicButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(btnMobile, isMuted ? btnMobileOff : btnMobilePrimary)}
      aria-label={isMuted ? 'Unmute' : 'Mute'}
    >
      {isMuted ? <MicOff size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
    </button>
  );
});

interface MobileCameraButtonProps {
  isOff: boolean;
  onToggle: () => void;
}

export const MobileCameraButton = memo(function MobileCameraButton({
  isOff,
  onToggle,
}: MobileCameraButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(btnMobile, isOff ? btnMobileOff : btnMobilePrimary)}
      aria-label={isOff ? 'Start camera' : 'Stop camera'}
    >
      {isOff ? <VideoOff size={20} aria-hidden="true" /> : <Video size={20} aria-hidden="true" />}
    </button>
  );
});

interface MobileChatButtonProps {
  isOpen: boolean;
  unreadCount: number;
  mentionCount?: number;
  onToggle: () => void;
}

export const MobileChatButton = memo(function MobileChatButton({
  isOpen,
  unreadCount,
  mentionCount = 0,
  onToggle,
}: MobileChatButtonProps) {
  const showMentionBadge = mentionCount > 0 && !isOpen;
  const showUnreadBadge = unreadCount > 0 && !showMentionBadge;
  
  return (
    <button
      onClick={onToggle}
      className={cn(btnMobile, isOpen ? btnAccent : btnMobileSecondary, 'relative')}
      aria-label={isOpen ? 'Close chat' : 'Open chat'}
    >
      <MessageSquare size={20} aria-hidden="true" />
      {/* Mention badge - takes priority */}
      {showMentionBadge && (
        <span className="absolute -top-0.5 -right-0.5 bg-brand-500 text-white text-[8px] min-w-[16px] h-4 px-0.5 rounded-full flex items-center justify-center font-bold">
          @{mentionCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : mentionCount}
        </span>
      )}
      {/* Unread badge - only shown when no mentions */}
      {showUnreadBadge && (
        <span className="absolute -top-0.5 -right-0.5 bg-danger-500 text-white text-[8px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
          {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
        </span>
      )}
    </button>
  );
});

// ============================================
// Mobile Recording Button
// ============================================

interface MobileRecordingButtonProps {
  isRecording: boolean;
  isLoading: boolean;
  onToggle: () => void;
}

export const MobileRecordingButton = memo(function MobileRecordingButton({
  isRecording,
  isLoading,
  onToggle,
}: MobileRecordingButtonProps) {
  return (
    <button
      onClick={onToggle}
      disabled={isLoading}
      className={cn(
        btnMobile,
        isRecording ? 'bg-danger-500 hover:bg-danger-600 text-white' : btnMobileSecondary,
        isLoading && 'opacity-70 cursor-wait'
      )}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isLoading ? (
        <Loader2 size={20} className="animate-spin" aria-hidden="true" />
      ) : isRecording ? (
        <CircleDot size={20} className="animate-pulse" aria-hidden="true" />
      ) : (
        <Circle size={20} aria-hidden="true" />
      )}
    </button>
  );
});

// ============================================
// Controls Menu (Moderator Only)
// ============================================

interface ControlsMenuProps {
  show: boolean;
  onClose: () => void;
  meetingLocked: boolean;
  lobbyEnabled: boolean;
  participantsCanShareScreen: boolean;
  participantsCanChat: boolean;
  participantsCanUnmute: boolean;
  participantsCanTurnOnCamera: boolean;
  // Lock + lobby are optional — hidden when feature-locked (undefined handler)
  onToggleLock?: () => void;
  onToggleLobby?: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleUnmute: () => void;
  onToggleCamera: () => void;
}

export const ControlsMenu = memo(function ControlsMenu({
  show,
  onClose,
  meetingLocked,
  lobbyEnabled,
  participantsCanShareScreen,
  participantsCanChat,
  participantsCanUnmute,
  participantsCanTurnOnCamera,
  onToggleLock,
  onToggleLobby,
  onToggleScreenShare,
  onToggleChat,
  onToggleUnmute,
  onToggleCamera,
}: ControlsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      {createPortal(
        <>
          <div className="fixed inset-0 z-[9997]" onClick={onClose} />
          <div
            ref={menuRef}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-surface-700 rounded-xl shadow-lg border border-surface-600 py-2 min-w-[280px] max-h-[80vh] overflow-y-auto z-[9998] animate-fade-in"
            role="menu"
          >
            <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400 border-b border-surface-600 mb-1">
              Meeting Controls
            </div>

            {onToggleLock && (
              <ToggleButton label="Lock Meeting" icon={meetingLocked ? <Lock size={16} className="text-warning-400" /> : <Unlock size={16} />} isActive={meetingLocked} onToggle={onToggleLock} />
            )}
            {onToggleLobby && (
              <ToggleButton label="Enable Lobby" icon={<DoorOpen size={16} />} isActive={lobbyEnabled} onToggle={onToggleLobby} />
            )}

            <div className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-surface-400 border-t border-b border-surface-600 my-1 mt-2">
              Allow All Participants To
            </div>

            <ToggleButton label="Share Screen" icon={<ScreenShare size={16} />} isActive={participantsCanShareScreen} onToggle={onToggleScreenShare} />
            <ToggleButton label="Chat" icon={<MessageCircle size={16} />} isActive={participantsCanChat} onToggle={onToggleChat} />
            <ToggleButton label="Unmute Themselves" icon={<MicIcon size={16} />} isActive={participantsCanUnmute} onToggle={onToggleUnmute} />
            <ToggleButton label="Turn On Camera" icon={<Camera size={16} />} isActive={participantsCanTurnOnCamera} onToggle={onToggleCamera} />
          </div>
        </>,
        document.body,
      )}
    </>
  );
});

// ============================================
// Toggle Button Helper
// ============================================

interface ToggleButtonProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onToggle: () => void;
}

const ToggleButton = memo(function ToggleButton({
  label,
  icon,
  isActive,
  onToggle,
}: ToggleButtonProps) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center justify-between gap-3 w-full px-4 py-2.5 text-sm text-white hover:bg-surface-600 transition-colors cursor-pointer"
      role="menuitem"
    >
      <div className="flex items-center gap-3">
        {icon}
        <span>{label}</span>
      </div>
      <div className={cn(
        'w-10 h-5 rounded-full relative transition-colors',
        isActive ? 'bg-brand-500' : 'bg-surface-500'
      )}>
        <div className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
          isActive ? 'translate-x-5' : 'translate-x-0.5'
        )} />
      </div>
    </button>
  );
});

// ============================================
// More Menu
// ============================================

interface MoreMenuItem {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface MoreMenuProps {
  show: boolean;
  onClose: () => void;
  items: MoreMenuItem[];
  isRecording?: boolean;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export const MoreMenu = memo(function MoreMenu({
  show,
  onClose,
  items,
  isRecording,
  anchorRef,
}: MoreMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ bottom: number; right: number } | null>(null);

  useEffect(() => {
    if (!show || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      bottom: window.innerHeight - rect.top + 8,
      right: window.innerWidth - rect.right,
    });
  }, [show, anchorRef]);

  useEffect(() => {
    if (!show) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show, onClose]);

  if (!show) return null;

  return (
    <>
      {createPortal(
        <>
          <div className="fixed inset-0 z-[9997]" onClick={onClose} />
          <div
            ref={menuRef}
            className="fixed bg-surface-700 rounded-xl shadow-lg border border-surface-600 py-1 min-w-[160px] max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto z-[9998] animate-fade-in"
            style={position ? { bottom: `${position.bottom}px`, right: `${position.right}px` } : { bottom: '5rem', right: '1rem' }}
            role="menu"
          >
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => { item.onClick(); onClose(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-white hover:bg-surface-600 transition-colors cursor-pointer whitespace-nowrap"
                role="menuitem"
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            {isRecording && (
              <div className="flex items-center gap-3 px-4 py-2.5 text-danger-400 text-sm border-t border-surface-600 mt-1 pt-2 whitespace-nowrap">
                <Circle size={10} className="animate-pulse fill-current" aria-hidden="true" />
                <span>Recording in progress</span>
              </div>
            )}
          </div>
        </>,
        document.body,
      )}
    </>
  );
});

// ============================================
// Memoized More Menu (Desktop)
// ============================================

type SettingsViewType = 'devices' | 'call-health' | 'video-effects';

interface MemoizedMoreMenuProps {
  show: boolean;
  onClose: () => void;
  isRecording: boolean;
  joinLeaveSoundsEnabled: boolean;
  onToggleJoinLeaveSounds: () => void;
  mirrorLocalVideo: boolean;
  onToggleMirrorLocalVideo: () => void;
  settingsOpen: boolean;
  onOpenSettings: (view: SettingsViewType) => void;
  onCopyLink: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export const MemoizedMoreMenu = memo(function MemoizedMoreMenu({
  show,
  onClose,
  isRecording,
  joinLeaveSoundsEnabled,
  onToggleJoinLeaveSounds,
  mirrorLocalVideo,
  onToggleMirrorLocalVideo,
  settingsOpen,
  onOpenSettings,
  onCopyLink,
  anchorRef,
}: MemoizedMoreMenuProps) {
  const items: MoreMenuItem[] = [
    { icon: <Link2 size={16} />, label: 'Copy Meeting Link', onClick: onCopyLink },
    ...(meetingRoomConfig.features.joinLeaveSoundToggle ? [{
      icon: joinLeaveSoundsEnabled ? <Bell size={16} /> : <BellOff size={16} />,
      label: joinLeaveSoundsEnabled ? 'Mute Sounds' : 'Enable Sounds',
      onClick: onToggleJoinLeaveSounds,
    }] : []),
    ...(meetingRoomConfig.features.mirrorLocalVideoToggle ? [{
      icon: <FlipHorizontal size={16} />,
      label: mirrorLocalVideo ? 'Unmirror My Tile' : 'Mirror My Tile',
      onClick: onToggleMirrorLocalVideo,
    }] : []),
    ...(meetingRoomConfig.features.settingsPanelDeviceFallback ? [{
      icon: <Mic size={16} />,
      label: settingsOpen ? 'Close Device Settings' : 'Device Settings',
      onClick: () => onOpenSettings('devices'),
    }] : []),
    { icon: <Activity size={16} />, label: 'Call Health', onClick: () => onOpenSettings('call-health') },
    { icon: <Sparkles size={16} />, label: 'Video Effects', onClick: () => onOpenSettings('video-effects') },
  ];

  return <MoreMenu show={show} onClose={onClose} items={items} isRecording={isRecording} anchorRef={anchorRef} />;
});

// ============================================
// Memoized More Menu (Mobile)
// ============================================

interface MemoizedMobileMoreMenuProps {
  show: boolean;
  onClose: () => void;
  isRecording: boolean;
  isRecordingLoading: boolean;
  onToggleRecording?: () => void;
  isScreenSharing: boolean | undefined;
  onToggleScreenShare?: () => void;
  handRaised: boolean;
  onToggleHandRaise: () => void;
  layout: string;
  onToggleLayout: () => void;
  joinLeaveSoundsEnabled: boolean;
  onToggleJoinLeaveSounds: () => void;
  mirrorLocalVideo: boolean;
  onToggleMirrorLocalVideo: () => void;
  settingsOpen: boolean;
  onOpenSettings: (view: SettingsViewType) => void;
  onToggleParticipants: () => void;
  onCopyLink: () => void;
  whiteboardOpen: boolean;
  onToggleWhiteboard?: () => void;
  isModerator: boolean;
  meetingLocked: boolean;
  lobbyEnabled: boolean;
  participantsCanShareScreen: boolean;
  participantsCanChat: boolean;
  participantsCanUnmute: boolean;
  participantsCanTurnOnCamera: boolean;
  onToggleLock?: () => void;
  onToggleLobby?: () => void;
  onToggleParticipantScreenShare: () => void;
  onToggleParticipantChat: () => void;
  onToggleParticipantUnmute: () => void;
  onToggleParticipantCamera: () => void;
  anchorRef?: React.RefObject<HTMLButtonElement | null>;
}

export const MemoizedMobileMoreMenu = memo(function MemoizedMobileMoreMenu({
  show,
  onClose,
  isRecording,
  isRecordingLoading,
  onToggleRecording,
  isScreenSharing,
  onToggleScreenShare,
  handRaised,
  onToggleHandRaise,
  layout,
  onToggleLayout,
  joinLeaveSoundsEnabled,
  onToggleJoinLeaveSounds,
  mirrorLocalVideo,
  onToggleMirrorLocalVideo,
  settingsOpen,
  onOpenSettings,
  onToggleParticipants,
  onCopyLink,
  whiteboardOpen,
  onToggleWhiteboard,
  isModerator,
  meetingLocked,
  lobbyEnabled,
  participantsCanShareScreen,
  participantsCanChat,
  participantsCanUnmute,
  participantsCanTurnOnCamera,
  onToggleLock,
  onToggleLobby,
  onToggleParticipantScreenShare,
  onToggleParticipantChat,
  onToggleParticipantUnmute,
  onToggleParticipantCamera,
  anchorRef,
}: MemoizedMobileMoreMenuProps) {
  const items: MoreMenuItem[] = [
    ...(onToggleScreenShare ? [{ icon: <Monitor size={16} />, label: isScreenSharing ? 'Stop Share' : 'Share Screen', onClick: onToggleScreenShare }] : []),
    { icon: <Hand size={16} className={handRaised ? 'text-warning-500' : ''} />, label: handRaised ? 'Lower Hand' : 'Raise Hand', onClick: onToggleHandRaise },
    { icon: layout === 'grid' ? <SquarePlay size={16} /> : <LayoutGrid size={16} />, label: layout === 'grid' ? 'Speaker View' : 'Grid View', onClick: onToggleLayout },
    ...(meetingRoomConfig.features.joinLeaveSoundToggle ? [{
      icon: joinLeaveSoundsEnabled ? <Bell size={16} /> : <BellOff size={16} />,
      label: joinLeaveSoundsEnabled ? 'Mute Sounds' : 'Enable Sounds',
      onClick: onToggleJoinLeaveSounds,
    }] : []),
    ...(meetingRoomConfig.features.mirrorLocalVideoToggle ? [{
      icon: <FlipHorizontal size={16} />,
      label: mirrorLocalVideo ? 'Unmirror My Tile' : 'Mirror My Tile',
      onClick: onToggleMirrorLocalVideo,
    }] : []),
    ...(meetingRoomConfig.features.settingsPanelDeviceFallback ? [{
      icon: <Mic size={16} />,
      label: settingsOpen ? 'Close Device Settings' : 'Device Settings',
      onClick: () => onOpenSettings('devices'),
    }] : []),
    { icon: <Activity size={16} />, label: 'Call Health', onClick: () => onOpenSettings('call-health') },
    { icon: <Sparkles size={16} />, label: 'Video Effects', onClick: () => onOpenSettings('video-effects') },
    { icon: <Users size={16} />, label: 'People', onClick: onToggleParticipants },
    { icon: <Link2 size={16} />, label: 'Copy Link', onClick: onCopyLink },
    ...(onToggleWhiteboard ? [{ icon: <Pencil size={16} />, label: whiteboardOpen ? 'Close Whiteboard' : 'Whiteboard', onClick: onToggleWhiteboard }] : []),
    ...(isModerator ? [
      ...(onToggleRecording ? [{ icon: isRecordingLoading ? <Loader2 size={16} className="animate-spin" /> : isRecording ? <CircleDot size={16} className="animate-pulse text-danger-400" /> : <Circle size={16} />, label: isRecording ? 'Stop Recording' : 'Start Recording', onClick: onToggleRecording, danger: isRecording }] : []),
      ...(onToggleLock ? [{ icon: meetingLocked ? <Lock size={16} className="text-warning-400" /> : <Unlock size={16} />, label: meetingLocked ? 'Unlock Meeting' : 'Lock Meeting', onClick: onToggleLock }] : []),
      ...(onToggleLobby ? [{ icon: <DoorOpen size={16} />, label: lobbyEnabled ? 'Disable Lobby' : 'Enable Lobby', onClick: onToggleLobby }] : []),
      { icon: <ScreenShare size={16} className={participantsCanShareScreen ? 'text-brand-400' : ''} />, label: participantsCanShareScreen ? 'Disallow Screen Share' : 'Allow Screen Share', onClick: onToggleParticipantScreenShare },
      { icon: <MessageCircle size={16} className={participantsCanChat ? 'text-brand-400' : ''} />, label: participantsCanChat ? 'Mute Participant Chat' : 'Allow Participant Chat', onClick: onToggleParticipantChat },
      { icon: <MicIcon size={16} className={participantsCanUnmute ? 'text-brand-400' : ''} />, label: participantsCanUnmute ? 'Mute All Participants' : 'Allow Unmute', onClick: onToggleParticipantUnmute },
      { icon: <Camera size={16} className={participantsCanTurnOnCamera ? 'text-brand-400' : ''} />, label: participantsCanTurnOnCamera ? 'Disable Cameras' : 'Allow Cameras', onClick: onToggleParticipantCamera },
    ] : []),
  ];

  return <MoreMenu show={show} onClose={onClose} items={items} isRecording={isRecording} anchorRef={anchorRef} />;
});

// Export icons for use in ControlBar
export const MoreIcon = MoreVertical;
export const ControlsIcon = Lock;
export const ControlsIconUnlocked = Unlock;
export { Lock, Unlock };
