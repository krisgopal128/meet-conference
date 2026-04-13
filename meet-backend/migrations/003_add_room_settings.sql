-- Add settings column to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}'::jsonb;

-- Create index for faster settings queries
CREATE INDEX IF NOT EXISTS idx_rooms_settings ON rooms USING GIN (settings);
