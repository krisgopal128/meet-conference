import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParticipants, useLocalParticipant, useRoomContext } from '@livekit/components-react';
import type { RemoteParticipant, LocalParticipant } from 'livekit-client';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  useRaisedHands,
  useIsModerator,
  useUIActions,
} from '../../store/roomStore';
import { roomsApi } from '../../services/api';
import type { LobbyParticipant as ApiLobbyParticipant } from '../../types/api';
import { X, UserCheck, UserX, Users, Clock, Mic2, CameraOff } from 'lucide-react';
import { meetingRoomConfig } from '../../config/meetingRoomConfig';
import ParticipantListItem, { getInitials } from './ParticipantListItem';
import { useParticipantActions } from '../../hooks/useParticipantActions';
import logger from '../../utils/logger';

// Sort options for participants
type SortOption = 'name' | 'joinTime' | 'role';

interface SortConfig {
  value: SortOption;
  label: string;
}

const sortOptions: SortConfig[] = [
  { value: 'name', label: 'Name' },
  { value: 'joinTime', label: 'Join Time' },
  { value: 'role', label: 'Role' },
];

// Local storage key for persisting sort preference
const SORT_PREFERENCE_KEY = 'participants-sort-preference';

// Get persisted sort preference
function getPersistedSortPreference(): SortOption {
  try {
    const stored = localStorage.getItem(SORT_PREFERENCE_KEY);
    if (stored && sortOptions.some(opt => opt.value === stored)) {
      return stored as SortOption;
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'name'; // Default sort
}

// Persist sort preference
function persistSortPreference(sort: SortOption): void {
  try {
    localStorage.setItem(SORT_PREFERENCE_KEY, sort);
  } catch {
    // Ignore localStorage errors
  }
}

export function ParticipantsPanel() {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const room = useRoomContext();
  
  // Optimized selectors
  const raisedHands = useRaisedHands();
  const isModerator = useIsModerator();

  // Action hooks
  const { toggleParticipants, setLobbyCount } = useUIActions();
  
  // Local state
  const [lobbyParticipants, setLobbyParticipants] = useState<{ identity: string; name: string; joinedAt: number }[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>(() => getPersistedSortPreference());

  // Wire up extracted participant actions hook
  const {
    admitting,
    pendingParticipantActions,
    muteAllPending,
    bulkActionPending,
    handleAdmit,
    handleDeny,
    handleMute,
    handleDisableCamera,
    handleDisableScreenShare,
    handleKick,
    handleMuteAll,
    handleDisableAllCameras,
    handleAdmitAll,
    handleDenyAll,
  } = useParticipantActions(room, setLobbyCount, setLobbyParticipants, lobbyParticipants);

  // Handle sort change with persistence
  const handleSortChange = useCallback((newSort: SortOption) => {
    setSortBy(newSort);
    persistSortPreference(newSort);
  }, []);

  // Fetch lobby participants periodically for moderators
  useEffect(() => {
    if (!isModerator) return;
    
    const fetchLobby = async () => {
      try {
        const res = await roomsApi.getLobby(room.name);
        const lobby = res.data.lobby || [];
        setLobbyCount(lobby.length);
        setLobbyParticipants(lobby.map((p: ApiLobbyParticipant) => ({
          identity: p.identity,
          name: p.name || p.identity,
          joinedAt: Date.now(),
        })));
      } catch (err) {
        logger.error('Failed to fetch lobby:', err);
      }
    };

    fetchLobby();
    let pollTimeout: ReturnType<typeof setTimeout>;
    let consecutiveErrors = 0;
    const scheduleNext = () => {
      const delay = consecutiveErrors > 2 ? 60000 : 10000; // Back off to 60s after 3 errors
      pollTimeout = setTimeout(async () => {
        try {
          await fetchLobby();
          consecutiveErrors = 0;
        } catch {
          consecutiveErrors++;
        }
        scheduleNext();
      }, delay);
    };
    scheduleNext();
    return () => clearTimeout(pollTimeout);
  }, [isModerator, room.name, setLobbyCount]);

  // Listen for new participants joining
  useEffect(() => {
    if (!isModerator) return;

    const handleParticipantConnected = (p: RemoteParticipant | LocalParticipant) => {
      if (!p.permissions?.canPublish) {
        setLobbyParticipants((prev) => {
          if (prev.some((lp) => lp.identity === p.identity)) return prev;
          const next = [...prev, { identity: p.identity, name: p.name || p.identity, joinedAt: Date.now() }];
          setLobbyCount(next.length);
          return next;
        });
      }
    };
    
    room.on('participantConnected', handleParticipantConnected);
    return () => {
      room.off('participantConnected', handleParticipantConnected);
    };
  }, [room, isModerator, setLobbyCount]);

  // Filter participants
  const activeParticipants = participants.filter((p) => p.permissions?.canPublish !== false);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  
  const filteredLobbyParticipants = lobbyParticipants.filter((participant) => {
    if (!normalizedQuery) return true;
    return `${participant.name} ${participant.identity}`.toLowerCase().includes(normalizedQuery);
  });
  
  const filteredActiveParticipants = activeParticipants.filter((participant) => {
    if (!normalizedQuery) return true;
    return `${participant.name || participant.identity} ${participant.identity}`.toLowerCase().includes(normalizedQuery);
  });

  // Sort participants based on selected sort option
  const sortedParticipants = useMemo(() => {
    const sorted = [...filteredActiveParticipants];
    
    switch (sortBy) {
      case 'name':
        sorted.sort((a, b) => {
          const nameA = (a.name || a.identity).toLowerCase();
          const nameB = (b.name || b.identity).toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
      case 'joinTime':
        sorted.sort((a, b) => {
          // Local participant should be first, then by join time
          if (a.identity === localParticipant?.identity) return -1;
          if (b.identity === localParticipant?.identity) return 1;
          // For remote participants, use join time if available
          const joinTimeA = (a as RemoteParticipant).joinedAt?.getTime?.() || 0;
          const joinTimeB = (b as RemoteParticipant).joinedAt?.getTime?.() || 0;
          return joinTimeA - joinTimeB;
        });
        break;
      case 'role':
        sorted.sort((a, b) => {
          // Moderators (canPublish) first, then by name
          const canPublishA = a.permissions?.canPublish ? 1 : 0;
          const canPublishB = b.permissions?.canPublish ? 1 : 0;
          if (canPublishA !== canPublishB) {
            return canPublishB - canPublishA;
          }
          const nameA = (a.name || a.identity).toLowerCase();
          const nameB = (b.name || b.identity).toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
    }
    
    return sorted;
  }, [filteredActiveParticipants, sortBy, localParticipant?.identity]);

  // Sort lobby participants by join time (oldest first)
  const sortedLobbyParticipants = useMemo(() => {
    return [...filteredLobbyParticipants].sort((a, b) => a.joinedAt - b.joinedAt);
  }, [filteredLobbyParticipants]);

  return (
    <div className="w-72 flex flex-col bg-surface-800 border-l border-surface-700">
      {/* Header */}
      <div className="px-4 py-3 border-b border-surface-700">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-surface-100">
            Participants ({activeParticipants.length})
          </h2>
          <button 
            onClick={toggleParticipants} 
            className="p-1.5 rounded-lg text-surface-400 hover:text-surface-200 hover:bg-surface-700 transition-colors"
            aria-label="Close participants"
          >
            <X size={18} />
          </button>
        </div>
        {isModerator && activeParticipants.length > 1 && (
          <div className="flex items-center gap-2 mt-2">
            <button 
              onClick={handleMuteAll}
              disabled={muteAllPending || Boolean(bulkActionPending)}
              className="text-xs bg-surface-700 hover:bg-surface-600 text-surface-300 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Mute all participants"
            >
              <Mic2 size={12} />
              <span>{muteAllPending ? 'Muting...' : 'Mute All'}</span>
            </button>
            <button 
              onClick={handleDisableAllCameras}
              disabled={Boolean(bulkActionPending) || activeParticipants.length <= 1}
              className="text-xs bg-surface-700 hover:bg-surface-600 text-surface-300 px-2 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Disable all participant cameras"
            >
              <CameraOff size={12} />
              <span>{bulkActionPending === 'disable-cameras' ? 'Disabling...' : 'Disable Cameras'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Search & Sort */}
      <div className="px-4 py-3 border-b border-surface-700">
        <div className="flex items-center gap-2">
          {meetingRoomConfig.features.participantSearch && (
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search participants..."
              className="flex-1 bg-surface-700 text-surface-100 text-sm rounded-lg px-3 py-2 outline-none border border-surface-600 focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 placeholder:text-surface-500"
            />
          )}
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value as SortOption)}
            className="bg-surface-700 text-surface-100 text-sm rounded-lg px-2 py-2 outline-none border border-surface-600 focus:border-brand-500 cursor-pointer"
            aria-label="Sort participants"
          >
            <option value="joinTime">Join Time</option>
            <option value="name">Name</option>
            <option value="role">Role</option>
          </select>
        </div>
      </div>
      
      {/* Lobby section (moderator only) */}
      {isModerator && sortedLobbyParticipants.length > 0 && (
        <div className="border-b border-surface-700">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-warning-900/20">
            <Clock size={14} className="text-warning-400" />
            <span className="text-warning-300 text-sm font-medium">
              Lobby ({sortedLobbyParticipants.length})
            </span>
            {(meetingRoomConfig.moderation.admitAllFromLobby || meetingRoomConfig.moderation.denyAllFromLobby) && (
              <div className="ml-auto flex items-center gap-2">
                {meetingRoomConfig.moderation.admitAllFromLobby && (
                  <button
                    onClick={handleAdmitAll}
                    disabled={bulkActionPending !== null}
                    className="text-xs bg-success-600 hover:bg-success-700 text-white px-2 py-1 rounded-lg disabled:opacity-50"
                  >
                    {bulkActionPending === 'admit-all' ? 'Admitting...' : 'Admit All'}
                  </button>
                )}
                {meetingRoomConfig.moderation.denyAllFromLobby && (
                  <button
                    onClick={handleDenyAll}
                    disabled={bulkActionPending !== null}
                    className="text-xs bg-danger-600 hover:bg-danger-700 text-white px-2 py-1 rounded-lg disabled:opacity-50"
                  >
                    {bulkActionPending === 'deny-all' ? 'Denying...' : 'Deny All'}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
            {sortedLobbyParticipants.map((p) => (
              <div
                key={p.identity} 
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-900/10 border border-warning-700/30"
              >
                <div className="w-8 h-8 rounded-full bg-warning-600 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {getInitials(p.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-warning-200 text-sm truncate">{p.name}</p>
                  <p className="text-warning-500 text-xs">Waiting</p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleAdmit(p.identity)}
                    disabled={admitting === p.identity}
                    className="p-1.5 bg-success-600 hover:bg-success-700 rounded-lg transition-colors disabled:opacity-50"
                    title="Admit"
                  >
                    <UserCheck size={14} className="text-white" />
                  </button>
                  <button
                    onClick={() => handleDeny(p.identity)}
                    className="p-1.5 bg-danger-600 hover:bg-danger-700 rounded-lg transition-colors"
                    title="Deny"
                  >
                    <UserX size={14} className="text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Active participants list */}
      <div className="flex-1 overflow-y-auto p-2">
        <div className="flex items-center gap-2 px-3 py-2 text-surface-500 text-xs">
          <Users size={12} />
          <span>In Meeting</span>
        </div>
        {sortedParticipants.length === 0 && sortedLobbyParticipants.length === 0 ? (
          <div className="px-3 py-6 text-sm text-surface-500 text-center">
            No participants match your search.
          </div>
        ) : (
          <ActiveParticipantsList
            sortedParticipants={sortedParticipants}
            localParticipantIdentity={localParticipant?.identity}
            isModerator={isModerator}
            raisedHands={raisedHands}
            pendingParticipantActions={pendingParticipantActions}
            onMute={handleMute}
            onDisableCamera={handleDisableCamera}
            onDisableScreenShare={handleDisableScreenShare}
            onKick={handleKick}
          />
        )}
      </div>
    </div>
  );
}

// Virtualized active participants list
interface ActiveParticipantsListProps {
  sortedParticipants: (RemoteParticipant | LocalParticipant)[];
  localParticipantIdentity: string | undefined;
  isModerator: boolean;
  raisedHands: string[];
  pendingParticipantActions: Set<string>;
  onMute: (identity: string) => void;
  onDisableCamera: (identity: string) => void;
  onDisableScreenShare: (identity: string) => void;
  onKick: (identity: string) => void;
}

function ActiveParticipantsList({
  sortedParticipants,
  localParticipantIdentity,
  isModerator,
  raisedHands,
  pendingParticipantActions,
  onMute,
  onDisableCamera,
  onDisableScreenShare,
  onKick,
}: ActiveParticipantsListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sortedParticipants.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
      {virtualizer.getVirtualItems().map((virtualItem) => {
        const p = sortedParticipants[virtualItem.index];
        const isRemote = p.identity !== localParticipantIdentity;
        return (
          <div
            key={p.identity}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <ParticipantListItem
              participant={p}
              isRemote={isRemote}
              localIdentity={localParticipantIdentity}
              isModerator={isModerator}
              raisedHands={raisedHands}
              pendingActions={pendingParticipantActions}
              onMute={onMute}
              onDisableCamera={onDisableCamera}
              onDisableScreenShare={onDisableScreenShare}
              onKick={onKick}
            />
          </div>
        );
      })}
    </div>
  );
}
