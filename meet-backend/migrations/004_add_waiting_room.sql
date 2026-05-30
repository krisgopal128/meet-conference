-- Add waiting_room_enabled column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS waiting_room_enabled BOOLEAN DEFAULT true;

-- Add comment
COMMENT ON COLUMN rooms.waiting_room_enabled IS 'When true, non-host participants must wait in lobby until admitted by moderator';
