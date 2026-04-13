/**
 * PiPVideoGrid - Grid component for Picture-in-Picture window
 *
 * ROLE-BASED VIEWING LOGIC:
 * - Moderator sees: ALL participants with camera + active speakers + screen share + self
 * - Participant sees: Moderator + active speakers + screen share
 *
 * Priority sort: screen share > moderator > active speaker > others
 */

import { memo, useMemo } from 'react';
import { Participant, LocalParticipant, Track } from 'livekit-client';
import { VideoTrack,  ParticipantName,
  useIsSpeaking,
} from '@livekit/components-react';
import { Mic, MicOff } from 'lucide-react';
import { useMirrorLocalVideo, useDisplayName } from '../../store/roomStore';

interface PiPVideoGridProps {
  participants: Participant[];
  activeSpeaker: Participant | null;
  localParticipant: LocalParticipant | null;
  isModerator: boolean;
}

// Maximum participants to show in PiP grid
const MAX_PIP_PARTICIPANTS = 4;

/**
 * Get initials from name for avatar display
 */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
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

/**
 * Check if a participant is a moderator based on permissions
 */
function isParticipantModerator(participant: Participant): boolean {
  // Use permissions.canPublish to detect moderator role
  // Moderators typically have canPublish: true for all media types
  const permissions = participant.permissions;
  if (!permissions) return false;
  
  // Check if they have full publishing permissions (typical for moderators)
  return permissions.canPublish === true || 
    (Array.isArray(permissions.canPublish) && permissions.canPublish.length > 0);
}

/**
 * Sort participants by priority:
 * 1. Screen share presenter (handled separately in PiPContainer)
 * 2. Moderators
 * 3. Active speakers
 * 4. Others (by camera enabled status)
 */
function sortParticipantsByPriority(
  participants: Participant[],
  activeSpeaker: Participant | null,
  localIdentity: string | undefined,
): Participant[] {
  return [...participants].sort((a, b) => {
    // Always put local participant last (for self-view)
    const aIsLocal = a.identity === localIdentity;
    const bIsLocal = b.identity === localIdentity;
    if (aIsLocal && !bIsLocal) return 1;
    if (!aIsLocal && bIsLocal) return -1;

    // Active speakers have high priority
    const aIsSpeaker = activeSpeaker?.identity === a.identity;
    const bIsSpeaker = activeSpeaker?.identity === b.identity;
    if (aIsSpeaker && !bIsSpeaker) return -1;
    if (!aIsSpeaker && bIsSpeaker) return 1;

    // Moderators next
    const aIsMod = isParticipantModerator(a);
    const bIsMod = isParticipantModerator(b);
    if (aIsMod && !bIsMod) return -1;
    if (!aIsMod && bIsMod) return 1;

    // Then by camera enabled
    if (a.isCameraEnabled && !b.isCameraEnabled) return -1;
    if (!a.isCameraEnabled && b.isCameraEnabled) return 1;

    return 0;
  });
}

/**
 * Filter participants based on role-based viewing logic
 *
 * - Moderator sees: ALL participants with camera + active speakers + screen share + self
 * - Participant sees: Moderator + active speakers + screen share
 */
function filterParticipantsByRole(
  participants: Participant[],
  activeSpeaker: Participant | null,
  isModerator: boolean,
  localIdentity: string | undefined,
): Participant[] {
  if (isModerator) {
    // Moderators see all participants
    // Include those with camera, active speakers, and self
    return participants.filter((p) => {
      const isSelf = p.identity === localIdentity;
      const isSpeaker = activeSpeaker?.identity === p.identity;
      const hasCamera = p.isCameraEnabled;
      const isMod = isParticipantModerator(p);
      
      return isSelf || isSpeaker || hasCamera || isMod;
    });
  } else {
    // Regular participants see: Moderators + active speakers + self
    return participants.filter((p) => {
      const isSelf = p.identity === localIdentity;
      const isSpeaker = activeSpeaker?.identity === p.identity;
      const isMod = isParticipantModerator(p);
      
      return isSelf || isSpeaker || isMod;
    });
  }
}

// Memoized participant tile for PiP
interface PiPParticipantTileProps {
  participant: Participant;
  isLocal: boolean;
}

const PiPParticipantTile = memo(function PiPParticipantTile({ 
  participant, 
  isLocal 
}: PiPParticipantTileProps) {
  const isSpeaking = useIsSpeaking(participant);
  const mirrorLocalVideo = useMirrorLocalVideo();
  const localDisplayName = useDisplayName();
  
  // Get camera track
  const cameraTrack = useMemo(() => {
    const tracks = Array.from(participant.trackPublications.values());
    return tracks.find(pub => pub.source === Track.Source.Camera);
  }, [participant]);
  
  const hasVideo = participant.isCameraEnabled && cameraTrack?.track;
  const isMicMuted = !participant.isMicrophoneEnabled;
  
  // Get participant name
  const participantName = isLocal
    ? (participant.name || localDisplayName || participant.identity || '')
    : (participant.name || participant.identity || '');
  const initials = getInitials(participantName);

  return (
    <div className={`pip-tile relative w-full h-full bg-surface-800 rounded-lg overflow-hidden ${
      isSpeaking ? 'ring-2 ring-brand-400' : ''
    }`}>
      {/* Video or avatar */}
      <div className="absolute inset-0">
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
            <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold text-white ${
              isSpeaking ? 'bg-brand-500' : 'bg-surface-600'
            }`}>
              {initials}
            </div>
          </div>
        )}
      </div>

      {/* Name bar */}
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2 py-1 flex items-center gap-1.5">
        {isMicMuted ? (
          <MicOff size={12} className="text-danger-400 shrink-0" />
        ) : (
          <Mic size={12} className={`${isSpeaking ? 'text-brand-400' : 'text-surface-300'} shrink-0`} />
        )}
        <span className="text-xs text-white truncate flex-1">
          {isLocal && !participant.name && localDisplayName 
            ? `${localDisplayName} (You)` 
            : <>
                <ParticipantName participant={participant} />
                {isLocal && ' (You)'}
              </>
          }
        </span>
      </div>
    </div>
  );
});

export function PiPVideoGrid({ 
  participants, 
  activeSpeaker, 
  localParticipant, 
  isModerator 
}: PiPVideoGridProps) {
  const localIdentity = localParticipant?.identity;

  // Apply role-based filtering
  const filteredParticipants = useMemo(() => {
    const filtered = filterParticipantsByRole(
      participants,
      activeSpeaker,
      isModerator,
      localIdentity,
    );
    return filtered;
  }, [participants, activeSpeaker, isModerator, localIdentity]);

  // Sort by priority
  const sortedParticipants = useMemo(() => {
    return sortParticipantsByPriority(
      filteredParticipants,
      activeSpeaker,
      localIdentity,
    );
  }, [filteredParticipants, activeSpeaker, localIdentity]);

  // Limit to max participants
  const displayParticipants = sortedParticipants.slice(0, MAX_PIP_PARTICIPANTS);

  // Determine grid layout based on participant count
  const gridLayout = useMemo(() => {
    const count = displayParticipants.length;
    if (count === 0) return { cols: 1, rows: 1 };
    if (count === 1) return { cols: 1, rows: 1 };
    if (count === 2) return { cols: 2, rows: 1 };
    if (count === 3) return { cols: 3, rows: 1 };
    return { cols: 2, rows: 2 }; // 4 participants
  }, [displayParticipants.length]);

  if (displayParticipants.length === 0) {
    return (
      <div className="pip-empty w-full h-full flex items-center justify-center bg-surface-800 text-surface-400">
        <div className="text-center">
          <p className="text-sm">No participants</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="pip-grid w-full h-full p-1 gap-1"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridLayout.cols}, 1fr)`,
        gridTemplateRows: `repeat(${gridLayout.rows}, 1fr)`,
      }}
    >
      {displayParticipants.map((participant) => (
        <PiPParticipantTile
          key={participant.identity}
          participant={participant}
          isLocal={participant.identity === localIdentity}
        />
      ))}
    </div>
  );
}
