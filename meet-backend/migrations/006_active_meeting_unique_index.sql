-- Prevent more than one active meeting row per room.
-- This closes race windows between host start and webhook join/start events.
CREATE UNIQUE INDEX IF NOT EXISTS idx_meetings_one_active_per_room
ON meetings(room_id)
WHERE ended_at IS NULL;
