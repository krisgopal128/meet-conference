import { useState, useEffect, useRef, memo } from 'react';
import { useIsSpeaking, useConnectionQualityIndicator } from '@livekit/components-react';
import type { RemoteParticipant, LocalParticipant } from 'livekit-client';
import { Hand, Mic, MicOff, Video, VideoOff, Monitor, LogOut } from 'lucide-react';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import SignalBars from '../room/SignalBars';

// Get initials from name
// - Single name (Kris) → K
// - Two names (Kris Prat) → KP
// - Three+ names (Kris Prat Jose) → KJ (first & last)
export function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  if (parts.length === 2) {
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }
  // 3+ names: first & last initial
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

export interface ParticipantListItemProps {
  participant: RemoteParticipant | LocalParticipant;
  isRemote: boolean;
  localIdentity?: string;
  isModerator: boolean;
  raisedHands: string[];
  pendingActions: Set<string>;
  onMute: (identity: string) => void;
  onDisableCamera: (identity: string) => void;
  onDisableScreenShare: (identity: string) => void;
  onKick: (identity: string) => void;
}

/**
 * Memoized participant list item component.
 * Renders a single participant row with avatar, name, status indicators,
 * and moderator action buttons.
 */
const ParticipantListItem = memo(function ParticipantListItem({
  participant,
  isRemote,
  localIdentity,
  isModerator,
  raisedHands,
  pendingActions,
  onMute,
  onDisableCamera,
  onDisableScreenShare,
  onKick,
}: ParticipantListItemProps) {
  const isSpeaking = useIsSpeaking(participant);
  const { quality: connectionQuality } = useConnectionQualityIndicator({ participant });
  const audioLevelRef = useRef(0);
  const [, forceUpdate] = useState(0);

  // Track audio level for visual indicator - use rAF instead of setInterval for efficiency
  useEffect(() => {
    if (!participant.isMicrophoneEnabled) {
      audioLevelRef.current = 0;
      forceUpdate(n => n + 1);
      return;
    }

    let rafId: number;
    let lastUpdate = 0;
    const UPDATE_INTERVAL_MS = 100; // Throttle to 10fps for audio bars (sufficient for visual)

    const updateLevel = (timestamp: number) => {
      if (timestamp - lastUpdate >= UPDATE_INTERVAL_MS) {
        const level = participant.audioLevel || 0;
        const newLevel = Math.min(1, level * 3);
        // Only trigger re-render if level changed meaningfully
        if (Math.abs(newLevel - audioLevelRef.current) > 0.05) {
          audioLevelRef.current = newLevel;
          forceUpdate(n => n + 1);
        }
        lastUpdate = timestamp;
      }
      rafId = requestAnimationFrame(updateLevel);
    };

    rafId = requestAnimationFrame(updateLevel);
    return () => cancelAnimationFrame(rafId);
  }, [participant.identity, participant.audioLevel, participant.isMicrophoneEnabled]);

  const hasAudio = participant.isMicrophoneEnabled;
  const isBusy = pendingActions.has(participant.identity);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-700 transition-colors ${
        isSpeaking ? 'bg-brand-900/20' : ''
      }`}
    >
      {/* Avatar with speaking ring (no mic indicator) */}
      <div className="relative">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 transition-all ${
          isSpeaking ? 'bg-brand-500 ring-2 ring-brand-400/50' : 'bg-brand-600'
        }`}>
          {getInitials(participant.name || participant.identity)}
        </div>
      </div>

      {/* Name and status */}
      <div className="flex-1 min-w-0">
        <p className="text-surface-100 text-sm truncate flex items-center gap-1.5">
          {participant.name || participant.identity}
          {participant.identity === localIdentity && (
            <span className="text-surface-500 text-xs">(You)</span>
          )}
          {raisedHands.includes(participant.identity) && (
            <Hand size={12} className="text-warning-500" />
          )}
        </p>
      </div>

      {/* Connection quality signal */}
      <div className="flex-shrink-0">
        <SignalBars quality={connectionQuality} compact />
      </div>

      {/* Combined mic/camera buttons - shows status and action for moderators */}
      <div className="flex items-center gap-1">
        {/* Mic button - shows status, clickable for moderators */}
        {isModerator && isRemote && hasAudio ? (
          <button
            onClick={() => onMute(participant.identity)}
            disabled={isBusy}
            className="p-1.5 hover:bg-danger-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Mute participant"
          >
            {isSpeaking ? (
              <div className="flex items-center gap-0.5 h-4">
                <div
                  className="w-1 bg-success-500 rounded-full transition-all duration-75"
                  style={{ height: `${4 + audioLevelRef.current * 12}px` }}
                />
                <div
                  className="w-1 bg-success-500 rounded-full transition-all duration-75"
                  style={{ height: `${6 + audioLevelRef.current * 10}px` }}
                />
                <div
                  className="w-1 bg-success-500 rounded-full transition-all duration-75"
                  style={{ height: `${4 + audioLevelRef.current * 12}px` }}
                />
              </div>
            ) : (
              <Mic size={14} className="text-surface-500 group-hover:text-danger-400" />
            )}
          </button>
        ) : (
          <div className="p-1.5">
            {!hasAudio ? (
              <MicOff size={14} className="text-danger-400" />
            ) : isSpeaking ? (
              <div className="flex items-center gap-0.5 h-4">
                <div
                  className="w-1 bg-success-500 rounded-full transition-all duration-75"
                  style={{ height: `${4 + audioLevelRef.current * 12}px` }}
                />
                <div
                  className="w-1 bg-success-500 rounded-full transition-all duration-75"
                  style={{ height: `${6 + audioLevelRef.current * 10}px` }}
                />
                <div
                  className="w-1 bg-success-500 rounded-full transition-all duration-75"
                  style={{ height: `${4 + audioLevelRef.current * 12}px` }}
                />
              </div>
            ) : (
              <Mic size={14} className="text-surface-500" />
            )}
          </div>
        )}

        {/* Camera button - shows status, clickable for moderators */}
        {isModerator && isRemote && participant.isCameraEnabled && meetingRoomConfig.moderation.disableParticipantCamera ? (
          <button
            onClick={() => onDisableCamera(participant.identity)}
            disabled={isBusy}
            className="p-1.5 hover:bg-danger-500/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
            title="Disable camera"
          >
            <Video size={14} className="text-surface-500 group-hover:text-danger-400" />
          </button>
        ) : (
          <div className="p-1.5">
            {!participant.isCameraEnabled ? (
              <VideoOff size={14} className="text-danger-400" />
            ) : (
              <Video size={14} className="text-surface-500" />
            )}
          </div>
        )}

        {/* Additional moderator actions */}
        {isModerator && isRemote && (
          <>
            {meetingRoomConfig.moderation.disableParticipantScreenShare && (
              <button
                onClick={() => onDisableScreenShare(participant.identity)}
                disabled={isBusy}
                className="p-1.5 hover:bg-surface-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                title="Disable screen share"
              >
                <Monitor size={14} className="text-surface-400 group-hover:text-warning-400" />
              </button>
            )}
            <button
              onClick={() => onKick(participant.identity)}
              disabled={isBusy}
              className="p-1.5 hover:bg-surface-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
              title="Remove from meeting"
            >
              <LogOut size={14} className="text-surface-400 group-hover:text-danger-400" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default ParticipantListItem;
