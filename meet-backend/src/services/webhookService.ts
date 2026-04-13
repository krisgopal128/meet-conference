import { query } from './database.js';
import { getParticipants } from './redis.js';

/**
 * Schedule a host leave check that transitions room to 'waiting' if host
 * doesn't rejoin within the grace period.
 */
export function scheduleHostLeaveCheck(
  roomName: string,
  hostIdentity: string,
  gracePeriodMs: number,
  onComplete: () => void
): NodeJS.Timeout {
  return setTimeout(async () => {
    try {
      // Double-check host is still not in the room
      const participants = await getParticipants(roomName);
      if (!participants.includes(hostIdentity)) {
        await query(
          "UPDATE rooms SET status = 'waiting' WHERE name = $1 AND status = 'active'",
          [roomName]
        );
      }
    } catch (err) {
      console.error(`[HostLeave] Error in timeout for room ${roomName}:`, err);
    } finally {
      onComplete();
    }
  }, gracePeriodMs);
}
