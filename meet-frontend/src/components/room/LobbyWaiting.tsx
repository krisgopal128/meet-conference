import { useEffect, useState } from 'react';
import { useRoomContext, useLocalParticipant } from '@livekit/components-react';
import { RoomEvent } from 'livekit-client';
import { useNavigate, Link } from 'react-router-dom';
import { Video, Clock, LogOut } from 'lucide-react';

interface LobbyWaitingProps {
  roomName?: string;
}

export function LobbyWaiting({ roomName }: LobbyWaitingProps) {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const navigate = useNavigate();
  const [admitted, setAdmitted] = useState(false);
  const [waitingTime, setWaitingTime] = useState(0);

  // Listen for permission changes (moderator admits guest)
  useEffect(() => {
    const handlePermissionChanged = (permissions: unknown) => {
      console.log('[LobbyWaiting] Permission changed:', permissions);
      const perms = permissions as { canPublish?: boolean };
      // Only admit when moderator explicitly grants publish permission
      if (perms?.canPublish === true) {
        console.log('[LobbyWaiting] Admitted by moderator - setting admitted to true');
        setAdmitted(true);
      }
    };

    room.localParticipant.on(RoomEvent.ParticipantPermissionsChanged, handlePermissionChanged);
    return () => {
      room.localParticipant.off(RoomEvent.ParticipantPermissionsChanged, handlePermissionChanged);
    };
  }, [room]);

  useEffect(() => {
    const timer = setInterval(() => {
      setWaitingTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeave = () => {
    room.disconnect();
    navigate('/');
  };

  if (admitted) {
    return null;
  }

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <div className="w-12 h-12 bg-brand-500 rounded-xl flex items-center justify-center">
              <Video className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-surface-800 dark:text-white">Meet</span>
          </Link>
        </div>

        {/* Card */}
        <div className="card p-8 text-center">
          {/* Waiting animation */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-brand-200 dark:border-brand-900 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-transparent border-t-brand-500 rounded-full animate-spin"></div>
            <div className="absolute inset-3 bg-brand-50 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
              <Clock className="w-6 h-6 text-brand-500" />
            </div>
          </div>

          <h1 className="text-xl font-semibold text-surface-800 dark:text-white mb-2">
            Waiting for the host
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mb-6">
            You're in the lobby for <span className="font-medium text-surface-700 dark:text-surface-300">{roomName || 'meeting'}</span>
          </p>

          {/* Waiting time */}
          <div className="bg-surface-50 dark:bg-surface-700/50 rounded-lg py-3 px-4 mb-6">
            <p className="text-surface-400 dark:text-surface-500 text-xs mb-1">Waiting time</p>
            <p className="text-2xl font-mono text-surface-800 dark:text-white">{formatTime(waitingTime)}</p>
          </div>

          {/* User info */}
          <div className="flex items-center justify-center gap-3 mb-6 p-3 bg-surface-50 dark:bg-surface-700/50 rounded-lg">
            <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center text-lg font-bold text-white">
              {(() => {
                const name = localParticipant.name || '';
                const parts = name.trim().split(/\s+/).filter(Boolean);
                if (parts.length === 0) return '?';
                if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
                if (parts.length === 2) return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
                return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
              })()}
            </div>
            <div className="text-left">
              <p className="font-medium text-surface-800 dark:text-white">{localParticipant.name || 'Guest'}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">You</p>
            </div>
          </div>

          {/* Tip */}
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-100 dark:border-brand-800 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-brand-700 dark:text-brand-300">
              <span className="font-medium">💡 Tip:</span> The host will see you're waiting and can admit you to the meeting. 
              Make sure your camera and microphone are ready.
            </p>
          </div>

          {/* Leave button */}
          <button
            onClick={handleLeave}
            className="btn-secondary w-full text-danger-600 border-danger-200 hover:bg-danger-50 dark:border-danger-800 dark:hover:bg-danger-900/20"
          >
            <LogOut size={18} />
            <span>Leave Lobby</span>
          </button>
        </div>
      </div>
    </div>
  );
}
