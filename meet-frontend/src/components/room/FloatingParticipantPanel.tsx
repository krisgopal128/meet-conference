/**
 * FloatingParticipantPanel — compact floating panel showing participant videos
 * Used inside fullscreen whiteboard mode so participants remain visible.
 * Renders as a toggleable sidebar overlay within the fullscreen container.
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { Track } from 'livekit-client';
import {
  VideoTrack,
  useIsSpeaking,
} from '@livekit/components-react';
import type { Participant, LocalParticipant } from 'livekit-client';
import { Mic, MicOff, Users, ChevronRight, ChevronLeft } from 'lucide-react';
import { useMirrorLocalVideo, useDisplayName } from '../../store/roomStore';

interface FloatingParticipantPanelProps {
  participants: Participant[];
  localParticipant: LocalParticipant;
}

const MAX_VISIBLE = 6;

function getPanelWidth(): number {
  const vw = window.innerWidth;
  if (vw < 480) return Math.round(vw * 0.4);
  return 220;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

interface MiniTileProps {
  participant: Participant;
  isLocal: boolean;
}

const MiniTile = memo(function MiniTile({ participant, isLocal }: MiniTileProps) {
  const isSpeaking = useIsSpeaking(participant);
  const mirrorLocalVideo = useMirrorLocalVideo();
  const localDisplayName = useDisplayName();

  const cameraTrack = useMemo(() => {
    const tracks = Array.from(participant.trackPublications.values());
    return tracks.find(pub => pub.source === Track.Source.Camera);
  }, [participant]);

  const hasVideo = participant.isCameraEnabled && cameraTrack?.track;
  const isMicMuted = !participant.isMicrophoneEnabled;

  const participantName = isLocal
    ? (participant.name || localDisplayName || participant.identity || '')
    : (participant.name || participant.identity || '');
  const initials = getInitials(participantName);

  return (
    <div className={`relative w-full bg-surface-800 rounded-lg overflow-hidden ${
      isSpeaking ? 'ring-2 ring-brand-400' : ''
    }`} style={{ aspectRatio: '16/9' }}>
      {/* Video or avatar */}
      {hasVideo && cameraTrack?.track ? (
        <VideoTrack
          trackRef={{
            participant,
            publication: cameraTrack,
            source: Track.Source.Camera,
          }}
          className={`w-full h-full object-cover ${isLocal && mirrorLocalVideo ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface-700 to-surface-800">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white ${
            isSpeaking ? 'bg-brand-500' : 'bg-surface-600'
          }`}>
            {initials}
          </div>
        </div>
      )}

      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-1.5 py-0.5 flex items-center gap-1">
        {isMicMuted ? (
          <MicOff size={10} className="text-danger-400 shrink-0" />
        ) : (
          <Mic size={10} className={`${isSpeaking ? 'text-brand-400' : 'text-surface-300'} shrink-0`} />
        )}
        <span className="text-[10px] text-white truncate flex-1">
          {participantName}
          {isLocal && ' (You)'}
        </span>
      </div>
    </div>
  );
});

export function FloatingParticipantPanel({
  participants,
  localParticipant,
}: FloatingParticipantPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const localIdentity = localParticipant?.identity ?? '';
  const panelWidth = getPanelWidth();

  // Sort: remote with camera first, then others, local last
  const sortedParticipants = useMemo(() => {
    return [...participants].sort((a, b) => {
      const aIsLocal = a.identity === localIdentity;
      const bIsLocal = b.identity === localIdentity;
      if (aIsLocal && !bIsLocal) return 1;
      if (!aIsLocal && bIsLocal) return -1;
      if (a.isCameraEnabled && !b.isCameraEnabled) return -1;
      if (!a.isCameraEnabled && b.isCameraEnabled) return 1;
      return 0;
    }).slice(0, MAX_VISIBLE);
  }, [participants, localIdentity]);

  const toggleCollapsed = useCallback(() => setCollapsed(prev => !prev), []);

  return (
    <div
      className="absolute top-0 right-0 bottom-0 z-50 flex"
      style={{
        width: collapsed ? 36 : panelWidth,
        transition: 'width 200ms ease',
      }}
    >
      {/* Toggle tab */}
      <button
        onClick={toggleCollapsed}
        className="flex-shrink-0 w-9 h-full bg-surface-800/60 hover:bg-surface-700/80 backdrop-blur-sm border-l border-surface-600/50 flex items-center justify-center cursor-pointer"
        title={collapsed ? 'Show participants' : 'Hide participants'}
        aria-label={collapsed ? 'Show participants' : 'Hide participants'}
      >
        {collapsed ? (
          <ChevronLeft size={16} className="text-surface-300" />
        ) : (
          <ChevronRight size={16} className="text-surface-300" />
        )}
      </button>

      {/* Participant grid */}
      {!collapsed && (
        <div className="flex-1 bg-surface-900/85 backdrop-blur-sm border-l border-surface-600/50 p-2 overflow-y-auto flex flex-col gap-1.5"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
        >
          <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-surface-700/50 mb-1">
            <Users size={12} className="text-surface-400" />
            <span className="text-[11px] font-medium text-surface-300">
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1.5">
            {sortedParticipants.map(p => (
              <MiniTile
                key={p.identity}
                participant={p}
                isLocal={p.identity === localIdentity}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
