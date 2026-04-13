import { removeParticipant, admitFromLobby } from './livekit.js';
import { addKickedParticipant, addAdmittedParticipant } from './redis.js';

interface LobbyParticipant {
  identity: string;
  name?: string;
  permission?: {
    canPublish?: boolean;
  };
}

/**
 * Process all lobby participants with a given action (admit or deny).
 * Returns the count of successfully processed participants.
 */
export async function processLobbyParticipants(
  roomName: string,
  participants: LobbyParticipant[],
  action: 'admit' | 'deny'
): Promise<number> {
  const lobbyParticipants = participants.filter(
    (p) => !p.permission?.canPublish
  );

  if (lobbyParticipants.length === 0) return 0;

  const results = await Promise.allSettled(
    lobbyParticipants.map(async (participant) => {
      if (action === 'admit') {
        await admitFromLobby(roomName, participant.identity);
        // Track admitted participant for auto-admit on rejoin
        await addAdmittedParticipant(roomName, participant.identity, participant.name);
      } else {
        await removeParticipant(roomName, participant.identity);
        await addKickedParticipant(
          roomName,
          participant.identity,
          participant.name || undefined
        );
      }
    })
  );

  return results.filter((r) => r.status === 'fulfilled').length;
}
