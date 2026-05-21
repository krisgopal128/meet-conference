import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRoom } from '../services/api';
import { useIsAuthenticated, useUser } from '../store/authStore';
import type { Room } from '../types';
import logger from '../utils/logger';

interface UsePreJoinAuthParams {
  roomName: string | undefined;
  isCreateMode: boolean;
  searchParams: URLSearchParams;
}

export function usePreJoinAuth({ roomName, isCreateMode, searchParams }: UsePreJoinAuthParams) {
  const navigate = useNavigate();
  const isAuthenticatedFromStore = useIsAuthenticated();
  const user = useUser();

  const [room, setRoom] = useState<Room | null>(null);

  const requestedRole = searchParams.get('role') as 'moderator' | 'guest' | null;

  const [isGuest, setIsGuest] = useState<boolean>(() => {
    if (requestedRole === 'guest') return true;
    if (requestedRole === 'moderator') return false;
    return true; // default to guest
  });

  useEffect(() => {
    // Check for token parameter - teacher one-click join
    const tokenParam = searchParams.get('t');
    const roleParam = searchParams.get('role');
    if (tokenParam && roomName) {
      logger.info('[PreJoin] Token found in URL, redirecting to room...');
      // Store token in sessionStorage for RoomPage to use
      sessionStorage.setItem(`token_${roomName}`, tokenParam);
      // Store role in sessionStorage as well (for moderator links)
      if (roleParam === 'moderator') {
        sessionStorage.setItem(`role_${roomName}`, roleParam);
      }
      // Navigate directly to room
      navigate(`/room/${roomName}`, { replace: true });
      return;
    }

    // Update isGuest based on zustand store (which handles hydration)
    // BUT respect role parameter: if role=moderator, don't allow guest mode
    if (requestedRole === 'moderator' && !isAuthenticatedFromStore) {
      // Moderator role requested but user not logged in - will show login prompt
      setIsGuest(false);
    } else {
      setIsGuest(!isAuthenticatedFromStore);
    }

    // Only fetch room if not in create mode
    if (roomName && !isCreateMode) {
      getRoom(roomName)
        .then((r) => {
          if (!r.data?.room) {
            // Room doesn't exist - redirect to 404
            navigate('/404', { replace: true });
            return;
          }
          setRoom(r.data.room);
        })
        .catch(() => {
          // Room not found - redirect to 404
          navigate('/404', { replace: true });
        });
    }
  }, [roomName, isCreateMode, searchParams, requestedRole, isAuthenticatedFromStore, navigate]);

  return {
    room,
    isGuest,
    requestedRole,
    isAuthenticatedFromStore,
    user,
  };
}
