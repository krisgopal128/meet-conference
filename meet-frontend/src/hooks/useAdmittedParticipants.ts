/**
 * useAdmittedParticipants - Shared hook for filtering admitted participants
 * 
 * Filters out lobby participants (those who cannot publish) from the participant list.
 * Used by both GridLayout and SpeakerLayout.
 */

import { useMemo } from 'react';
import type { Participant } from 'livekit-client';
import logger from '../utils/logger';

export function useAdmittedParticipants(
  participants: Participant[],
  localParticipantIdentity?: string
): Participant[] {
  return useMemo(() => {
    const admitted = participants.filter(p => {
      // Local participant is always admitted
      if (localParticipantIdentity && p.identity === localParticipantIdentity) return true;
      // Remote participants need canPublish permission
      // Note: permissions may be undefined initially until synced from server
      const canPublish = p.permissions?.canPublish !== false;
      return canPublish;
    });
    
    // Debug logging in development
    if (import.meta.env.DEV && participants.length !== admitted.length) {
      const filtered = participants.filter(p => !admitted.includes(p));
      logger.info('[useAdmittedParticipants] Filtered participants:', {
        total: participants.length,
        admitted: admitted.length,
        filtered: filtered.map(p => ({
          identity: p.identity,
          canPublish: p.permissions?.canPublish,
          permissions: p.permissions
        }))
      });
    }
    
    return admitted;
  }, [participants, localParticipantIdentity]);
}
