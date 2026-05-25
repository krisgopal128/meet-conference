/**
 * useParticipantActions - Moderator participant management actions
 *
 * Extracted from ParticipantsPanel to reduce component complexity.
 * Handles kick, mute, camera disable, lobby admit/deny, and bulk actions.
 */

import { useState, useCallback } from 'react';
import type { Room } from 'livekit-client';
import { roomsApi } from '../services/api';
import logger from '../utils/logger';
import toast from 'react-hot-toast';

interface LobbyParticipantState {
  identity: string;
  name: string;
  joinedAt: number;
}

export function useParticipantActions(
  room: Room,
  setLobbyCount: (count: number) => void,
  setLobbyParticipants: React.Dispatch<React.SetStateAction<LobbyParticipantState[]>>,
  lobbyParticipants: LobbyParticipantState[],
) {
  const [admitting, setAdmitting] = useState<string | null>(null);
  const [pendingParticipantActions, setPendingParticipantActions] = useState<Set<string>>(new Set());
  const [muteAllPending, setMuteAllPending] = useState(false);
  const [bulkActionPending, setBulkActionPending] = useState<string | null>(null);

  const getErrorMessage = (err: unknown, fallback: string) => {
    const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
    return message || fallback;
  };

  const withParticipantAction = useCallback(async (participantIdentity: string, action: () => Promise<void>) => {
    if (pendingParticipantActions.has(participantIdentity)) {
      return;
    }

    setPendingParticipantActions((prev) => new Set(prev).add(participantIdentity));
    try {
      await action();
    } finally {
      setPendingParticipantActions((prev) => {
        const next = new Set(prev);
        next.delete(participantIdentity);
        return next;
      });
    }
  }, [pendingParticipantActions]);

  // Admit participant from lobby
  const handleAdmit = useCallback(async (participantIdentity: string) => {
    setAdmitting(participantIdentity);
    try {
      await roomsApi.admitParticipant(room.name, participantIdentity);
      setLobbyParticipants((prev) => {
        const next = prev.filter((p) => p.identity !== participantIdentity);
        setLobbyCount(next.length);
        return next;
      });
      logger.info('[ParticipantsPanel] Participant admitted:', participantIdentity);
    } catch (err) {
      logger.error('Failed to admit participant:', err);
      toast.error('Failed to admit participant');
    } finally {
      setAdmitting(null);
    }
  }, [room.name, setLobbyCount, setLobbyParticipants]);

  // Deny participant
  const handleDeny = useCallback(async (participantIdentity: string) => {
    try {
      await roomsApi.kickParticipant(room.name, participantIdentity);
      setLobbyParticipants((prev) => {
        const next = prev.filter((p) => p.identity !== participantIdentity);
        setLobbyCount(next.length);
        return next;
      });
      logger.info('[ParticipantsPanel] Participant denied:', participantIdentity);
    } catch (err) {
      logger.error('Failed to deny participant:', err);
      toast.error('Failed to deny participant');
    }
  }, [room.name, setLobbyCount, setLobbyParticipants]);

  // Mute participant
  const handleMute = useCallback(async (participantIdentity: string) => {
    await withParticipantAction(participantIdentity, async () => {
      try {
        await roomsApi.muteParticipant(room.name, participantIdentity);
        logger.info('[ParticipantsPanel] Participant muted:', participantIdentity);
      } catch (err) {
        logger.error('Failed to mute participant:', err);
        toast.error('Failed to mute participant');
      }
    });
  }, [room.name, withParticipantAction]);
  
  // Disable camera
  const handleDisableCamera = useCallback(async (participantIdentity: string) => {
    await withParticipantAction(participantIdentity, async () => {
      try {
        await roomsApi.muteVideo(room.name, participantIdentity);
        logger.info('[ParticipantsPanel] Participant camera disabled:', participantIdentity);
      } catch (err) {
        logger.error('Failed to disable camera:', err);
        toast.error('Failed to disable camera');
      }
    });
  }, [room.name, withParticipantAction]);

  // Disable screen share
  const handleDisableScreenShare = useCallback(async (participantIdentity: string) => {
    await withParticipantAction(participantIdentity, async () => {
      try {
        await roomsApi.disableScreenShare(room.name, participantIdentity);
        logger.info('[ParticipantsPanel] Participant screen share disabled:', participantIdentity);
      } catch (err) {
        logger.error('Failed to disable screen share:', err);
        toast.error('Failed to disable screen share');
      }
    });
  }, [room.name, withParticipantAction]);

  // Kick participant
  const handleKick = useCallback(async (participantIdentity: string) => {
    await withParticipantAction(participantIdentity, async () => {
      try {
        await roomsApi.kickParticipant(room.name, participantIdentity);
        logger.info('[ParticipantsPanel] Participant removed:', participantIdentity);
      } catch (err) {
        logger.error('Failed to kick participant:', err);
        toast.error(getErrorMessage(err, 'Failed to remove participant'));
      }
    });
  }, [room.name, withParticipantAction]);

  // Mute all
  const handleMuteAll = useCallback(async () => {
    if (muteAllPending) return;
    setMuteAllPending(true);
    try {
      await roomsApi.muteAllParticipants(room.name);
      logger.info('[ParticipantsPanel] All participants muted');
    } catch (err) {
      logger.error('Failed to mute all participants:', err);
      toast.error('Failed to mute all participants');
    } finally {
      setMuteAllPending(false);
    }
  }, [room.name, muteAllPending]);

  // Disable all cameras
  const handleDisableAllCameras = useCallback(async () => {
    if (bulkActionPending) return;
    setBulkActionPending('disable-cameras');
    try {
      await roomsApi.disableAllCameras(room.name);
      logger.info('[ParticipantsPanel] All participant cameras disabled');
    } catch (err) {
      logger.error('Failed to disable all cameras:', err);
      toast.error('Failed to disable all cameras');
    } finally {
      setBulkActionPending(null);
    }
  }, [room.name, bulkActionPending]);

  // Admit all
  const handleAdmitAll = useCallback(async () => {
    if (bulkActionPending || lobbyParticipants.length === 0) return;
    setBulkActionPending('admit-all');
    try {
      await roomsApi.admitAllParticipants(room.name);
      setLobbyParticipants([]);
      setLobbyCount(0);
      logger.info('[ParticipantsPanel] All lobby participants admitted');
    } catch (err) {
      logger.error('Failed to admit all participants:', err);
      toast.error('Failed to admit all participants');
    } finally {
      setBulkActionPending(null);
    }
  }, [room.name, bulkActionPending, lobbyParticipants.length, setLobbyCount, setLobbyParticipants]);

  // Deny all
  const handleDenyAll = useCallback(async () => {
    if (bulkActionPending || lobbyParticipants.length === 0) return;
    setBulkActionPending('deny-all');
    try {
      await roomsApi.denyAllParticipants(room.name);
      setLobbyParticipants([]);
      setLobbyCount(0);
      logger.info('[ParticipantsPanel] All lobby participants denied');
    } catch (err) {
      logger.error('Failed to deny all participants:', err);
      toast.error('Failed to deny all participants');
    } finally {
      setBulkActionPending(null);
    }
  }, [room.name, bulkActionPending, lobbyParticipants.length, setLobbyCount, setLobbyParticipants]);

  return {
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
  };
}
