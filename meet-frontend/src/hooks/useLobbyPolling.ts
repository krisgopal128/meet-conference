import { useEffect } from 'react';
import { roomsApi } from '../services/api';
import type { LobbyParticipant as ApiLobbyParticipant } from '../types/api';
import logger from '../utils/logger';

type LobbySubscriber = (lobby: ApiLobbyParticipant[]) => void;

interface LobbyPollingEntry {
  subscribers: Set<LobbySubscriber>;
  timer: ReturnType<typeof setTimeout> | null;
  consecutiveErrors: number;
  latestLobby: ApiLobbyParticipant[];
  fetching: boolean;
}

const SHORT_POLL_MS = 5000;
const BACKOFF_POLL_MS = 60000;
const lobbyPollingRegistry = new Map<string, LobbyPollingEntry>();

function getEntry(roomName: string): LobbyPollingEntry {
  const existing = lobbyPollingRegistry.get(roomName);
  if (existing) return existing;

  const created: LobbyPollingEntry = {
    subscribers: new Set(),
    timer: null,
    consecutiveErrors: 0,
    latestLobby: [],
    fetching: false,
  };
  lobbyPollingRegistry.set(roomName, created);
  return created;
}

async function fetchLobby(roomName: string, entry: LobbyPollingEntry): Promise<void> {
  if (entry.fetching || document.hidden) return;
  entry.fetching = true;

  try {
    const res = await roomsApi.getLobby(roomName);
    entry.latestLobby = res.data.lobby || [];
    entry.consecutiveErrors = 0;
    entry.subscribers.forEach((subscriber) => subscriber(entry.latestLobby));
  } catch (error) {
    entry.consecutiveErrors += 1;
    logger.error('[LobbyPolling] Failed to fetch lobby:', error);
  } finally {
    entry.fetching = false;
  }
}

function schedulePoll(roomName: string, entry: LobbyPollingEntry): void {
  if (entry.timer) {
    clearTimeout(entry.timer);
  }

  if (entry.subscribers.size === 0) {
    entry.timer = null;
    return;
  }

  const delay = entry.consecutiveErrors > 2 ? BACKOFF_POLL_MS : SHORT_POLL_MS;
  entry.timer = setTimeout(async () => {
    await fetchLobby(roomName, entry);
    schedulePoll(roomName, entry);
  }, delay);
}

export function useLobbyPolling(
  roomName: string | undefined,
  enabled: boolean,
  onLobbyUpdate: LobbySubscriber,
) {
  useEffect(() => {
    if (!roomName || !enabled) return;

    const entry = getEntry(roomName);
    entry.subscribers.add(onLobbyUpdate);

    if (entry.latestLobby.length > 0) {
      onLobbyUpdate(entry.latestLobby);
    }

    const handleVisibilityChange = () => {
      if (document.hidden) return;
      void fetchLobby(roomName, entry);
      schedulePoll(roomName, entry);
    };

    void fetchLobby(roomName, entry);
    schedulePoll(roomName, entry);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      const current = lobbyPollingRegistry.get(roomName);
      if (!current) return;

      current.subscribers.delete(onLobbyUpdate);
      if (current.subscribers.size === 0) {
        if (current.timer) clearTimeout(current.timer);
        lobbyPollingRegistry.delete(roomName);
      }
    };
  }, [roomName, enabled, onLobbyUpdate]);
}
