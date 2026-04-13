-- Add waiting_room_enabled column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS waiting_room_enabled BOOLEAN DEFAULT false;

-- Add comment
COMMENT ON COLUMN rooms.waiting_room_enabled IS 'When true, guests must wait in lobby until admitted by moderator';
