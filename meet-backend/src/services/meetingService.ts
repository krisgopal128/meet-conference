import { queryOne } from './database.js';

/**
 * Verify that a user has access to a meeting (either as host or participant).
 * Returns the meeting if access is granted, null otherwise.
 */
export async function verifyMeetingAccess(
  meetingId: string,
  userId: string
): Promise<{ id: string; room_id: string } | null> {
  return queryOne<{ id: string; room_id: string }>(
    `SELECT m.id, m.room_id 
     FROM meetings m
     JOIN rooms r ON m.room_id = r.id
     WHERE m.id = $1 AND (r.host_id = $2 OR EXISTS (
       SELECT 1 FROM meeting_participants mp 
       WHERE mp.meeting_id = m.id AND mp.user_id = $2
     ))`,
    [meetingId, userId]
  );
}
